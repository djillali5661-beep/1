import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import * as storeDb from "./src/server/storeDb";

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for API routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Serve public static assets (tulip-extrait-default.jpg, tulip-logo.svg, PWA icons, etc.)
app.use(express.static(path.join(process.cwd(), "public")));

app.use(express.json({ limit: "25mb" }));

// Load / initialize persistent database
storeDb.loadDatabase();

// Health check & Server Status
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      company: "Tulip Fragrance Company",
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      storage: "persistent_file_db",
      timestamp: new Date().toISOString(),
    });
  });

  // Global Sync / Bootstrap Endpoint for Real-Time Multi-Device State
  app.get("/api/sync", (_req, res) => {
    try {
      const db = storeDb.loadDatabase();
      res.json({
        status: "ok",
        products: db.products,
        orders: db.orders,
        customerApplications: db.customerApplications,
        customerUsers: db.customerUsers,
        adBanners: db.adBanners,
        storeSettings: db.storeSettings,
        lastUpdated: db.lastUpdated,
        serverTime: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[API] /api/sync error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation." });
    }
  });

function escapeHtml(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BOT_SELF_ID = '8908435035';
// Verified active destinations from @tulip5661bot: Group "commande" (-5365585827) and User "Tulip Oran" (5680755596)
const DEFAULT_ACTIVE_CHATS = ['-5365585827', '5680755596'];

async function resolveTelegramConfig() {
  const db = storeDb.loadDatabase();
  const settings: any = db.storeSettings || {};

  let token = (process.env.TELEGRAM_BOT_TOKEN || settings.telegramBotToken || '8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8').trim();
  token = token.replace(/^["']|["']$/g, '');

  if (token && !token.includes(':')) {
    token = `8908435035:${token}`;
  }

  const targetChatIds = new Set<string>();

  // Collect configured chat IDs from settings and environment
  const rawSources = [settings.telegramChatId, process.env.TELEGRAM_CHAT_ID];
  for (const src of rawSources) {
    if (!src) continue;
    const parts = String(src).split(/[\s,;|]+/);
    for (const p of parts) {
      const trimmed = p.trim().replace(/^["']|["']$/g, '');
      if (trimmed && trimmed !== BOT_SELF_ID) {
        targetChatIds.add(trimmed);
      }
    }
  }

  // If no external valid chats were provided (or only the bot's own ID was supplied),
  // automatically include the verified active group and admin account
  if (targetChatIds.size === 0) {
    for (const id of DEFAULT_ACTIVE_CHATS) {
      targetChatIds.add(id);
    }
  }

  return {
    token,
    chatIds: Array.from(targetChatIds),
    primaryChatId: Array.from(targetChatIds)[0] || DEFAULT_ACTIVE_CHATS[0],
    enabled: settings.telegramNotificationsEnabled !== false,
  };
}

async function broadcastTelegramMessage(htmlMessage: string) {
  const config = await resolveTelegramConfig();
  if (!config.token || !config.enabled || config.chatIds.length === 0) {
    return { sentViaBot: false, error: 'Telegram non configuré ou désactivé' };
  }

  const deliveryReports: any[] = [];
  let successfulSends = 0;

  for (const cId of config.chatIds) {
    try {
      const tgUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
      const resp = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cId,
          text: htmlMessage,
          parse_mode: 'HTML',
        }),
      });
      const data = await resp.json();
      deliveryReports.push({ chatId: cId, ok: Boolean(data && data.ok), data });
      if (data && data.ok) {
        successfulSends++;
      } else {
        console.warn(`[Telegram Bot] Error sending to ${cId}:`, data?.description);
      }
    } catch (err: any) {
      console.warn(`[Telegram Bot] Fetch failure for ${cId}:`, err?.message);
      deliveryReports.push({ chatId: cId, ok: false, error: err?.message });
    }
  }

  return {
    sentViaBot: successfulSends > 0,
    successfulSends,
    totalTargets: config.chatIds.length,
    deliveryReports,
    message: htmlMessage,
    directTelegramUrl: `https://t.me/+213799938399`,
    botUsername: 'tulip5661bot',
  };
}

async function sendTelegramOrderNotification(order: any, _customPhone?: string) {
  const isProforma = Boolean(order.isProforma || (order.orderNumber && order.orderNumber.startsWith('PRO-')));

  const itemsSummary = (order.items || [])
    .map((i: any, idx: number) => {
      const qty = i.family === 'Extrait' ? `${i.quantity}g` : `${i.quantity}x ${i.unit}`;
      return `  <b>${idx + 1}.</b> ${escapeHtml(i.name)} [<code>${escapeHtml(i.code)}</code>] : <b>${qty}</b> = ${(i.totalDA || 0).toLocaleString('fr-DZ')} DA`;
    })
    .join('\n');

  const customerName = `${order.customer?.fullName || 'Client'} ${order.customer?.companyName ? `(${order.customer.companyName})` : ''}`;
  const customerPhone = order.customer?.phone || 'Non spécifié';
  const destination = `${order.customer?.wilayaCode || ''} - ${order.customer?.wilayaName || ''} (${order.customer?.commune || ''})`;
  const deliveryAddress = order.customer?.deliveryAddress ? `\n📍 <b>Adresse :</b> ${escapeHtml(order.customer.deliveryAddress)}` : '';
  const orderDate = new Date(order.date || Date.now()).toLocaleString('fr-DZ');
  const totalAmount = (order.totalDA || 0).toLocaleString('fr-DZ');

  let messageHtml = '';

  if (isProforma) {
    messageHtml =
      `📄 <b>NOUVELLE DEMANDE DE FACTURE PROFORMA</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <b>Type :</b> Devis Proforma Express\n` +
      `📋 <b>N° Proforma :</b> <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `👤 <b>Demandeur :</b> ${escapeHtml(customerName)}\n` +
      `📞 <b>Téléphone :</b> <code>${escapeHtml(customerPhone)}</code>\n` +
      `📍 <b>Destination :</b> ${escapeHtml(destination)}${deliveryAddress}\n\n` +
      `📦 <b>Articles Sélectionnés :</b>\n${itemsSummary}\n\n` +
      `💰 <b>TOTAL ESTIMATIF :</b> <b>${totalAmount} DA</b>\n` +
      `⏳ <b>Réservation stock :</b> 48 Heures\n` +
      `📅 <b>Date :</b> ${orderDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <i>Tulip Fragrance Company • Service Commercial Oran</i>`;
  } else {
    messageHtml =
      `🌸 <b>NOUVELLE PRÉCOMMANDE VALIDÉE - TULIP</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>Type :</b> Précommande Ferme\n` +
      `📋 <b>Bon N° :</b> <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `👤 <b>Client :</b> ${escapeHtml(customerName)}\n` +
      `📞 <b>Téléphone :</b> <code>${escapeHtml(customerPhone)}</code>\n` +
      `📍 <b>Destination :</b> ${escapeHtml(destination)}${deliveryAddress}\n` +
      `🚚 <b>Mode livraison :</b> ${escapeHtml(order.customer?.deliveryMode || 'Standard')}\n\n` +
      `📦 <b>Articles Réservés :</b>\n${itemsSummary}\n\n` +
      `💰 <b>TOTAL À RÉGLER :</b> <b>${totalAmount} DA</b>\n` +
      `📅 <b>Date :</b> ${orderDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <i>Tulip Fragrance Company • Bir El Djir, Oran</i>`;
  }

  return await broadcastTelegramMessage(messageHtml);
}

async function sendTelegramAccessRequestNotification(applicant: any) {
  const applicantName = escapeHtml(applicant.fullName || 'Nouveau Client');
  const company = applicant.companyName ? escapeHtml(applicant.companyName) : 'Non spécifié';
  const phone = escapeHtml(applicant.phone || 'Non spécifié');
  const secondaryPhone = applicant.secondaryPhone ? `\n📱 <b>Téléphone 2 :</b> <code>${escapeHtml(applicant.secondaryPhone)}</code>` : '';
  const email = applicant.email ? escapeHtml(applicant.email) : 'Non spécifié';
  const location = `${escapeHtml(applicant.wilayaCode || '')} - ${escapeHtml(applicant.wilayaName || '')} (${escapeHtml(applicant.commune || '')})`;
  const address = applicant.deliveryAddress ? `\n📍 <b>Adresse :</b> ${escapeHtml(applicant.deliveryAddress)}` : '';
  const notes = applicant.notes ? `\n📝 <b>Activité / Notes :</b> <i>${escapeHtml(applicant.notes)}</i>` : '';
  const dateStr = new Date(applicant.createdAt || applicant.date || Date.now()).toLocaleString('fr-DZ');

  const messageHtml =
    `🔑 <b>NOUVELLE DEMANDE D'ACCÈS PROFESSIONNEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 <b>Type :</b> Demande d'accès Tarifs Pro / Gros\n` +
    `👤 <b>Responsable :</b> ${applicantName}\n` +
    `🏪 <b>Établissement :</b> <b>${company}</b>\n` +
    `📞 <b>Téléphone :</b> <code>${phone}</code>${secondaryPhone}\n` +
    `✉️ <b>Email :</b> ${email}\n` +
    `📍 <b>Localisation :</b> ${location}${address}${notes}\n` +
    `⏳ <b>Statut :</b> 🟡 En attente de validation\n` +
    `📅 <b>Date :</b> ${dateStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 <i>Rendez-vous dans l'Espace Admin > Clients pour approuver ce compte.</i>\n` +
    `🏢 <i>Tulip Fragrance Company • Bir El Djir, Oran</i>`;

  return await broadcastTelegramMessage(messageHtml);
}

  // ---------------- ORDERS (COMMANDES) ----------------
  app.get("/api/orders", (_req, res) => {
    try {
      const orders = storeDb.getAllOrders();
      res.json({ success: true, orders });
    } catch (err: any) {
      console.error("[API] GET /api/orders error:", err);
      res.status(500).json({ error: "Impossible de récupérer les commandes." });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderPayload = req.body;
      if (!orderPayload || !orderPayload.customer || !Array.isArray(orderPayload.items)) {
        return res.status(400).json({ error: "Données de commande incomplètes." });
      }

      const { order, updatedProducts } = storeDb.createOrder(orderPayload);

      // Trigger Telegram notification
      let telegramStatus: any = null;
      try {
        telegramStatus = await sendTelegramOrderNotification(order);
      } catch (tgErr: any) {
        console.warn("[Telegram Bot] Notification trigger error:", tgErr?.message);
      }

      res.status(201).json({
        success: true,
        order,
        updatedProducts,
        telegram: telegramStatus,
      });
    } catch (err: any) {
      console.error("[API] POST /api/orders error:", err);
      res.status(500).json({ error: "Erreur lors de l'enregistrement de la commande." });
    }
  });

  app.put("/api/orders", (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Liste de commandes invalide." });
      }
      const { orders: updatedOrders, updatedProducts } = storeDb.syncOrders(orders);
      res.json({ success: true, orders: updatedOrders, updatedProducts });
    } catch (err: any) {
      console.error("[API] PUT /api/orders error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation des commandes." });
    }
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Le statut est requis." });
      }

      const result = storeDb.updateOrderStatus(id, status);
      if (!result) {
        return res.status(404).json({ error: "Commande introuvable." });
      }

      res.json({
        success: true,
        order: result.order,
        updatedProducts: result.updatedProducts,
      });
    } catch (err: any) {
      console.error("[API] PATCH /api/orders/:id/status error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut." });
    }
  });

  app.delete("/api/orders/:id", (req, res) => {
    try {
      const { id } = req.params;
      const result = storeDb.deleteOrder(id);
      res.json({ success: result.success, updatedProducts: result.updatedProducts });
    } catch (err: any) {
      console.error("[API] DELETE /api/orders/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression de la commande." });
    }
  });

  // ---------------- CUSTOMER AUTHENTICATION & ACCOUNTS ----------------
  app.post("/api/auth/register", async (req, res) => {
    try {
      const {
        fullName,
        companyName,
        phone,
        secondaryPhone,
        email,
        password,
        wilayaCode,
        wilayaName,
        commune,
        deliveryAddress,
        notes,
        autoApprove = false,
      } = req.body;

      if (!fullName || !phone) {
        return res.status(400).json({ error: "Le nom complet et le téléphone sont obligatoires." });
      }

      const { application, user } = storeDb.registerCustomer({
        fullName,
        companyName: companyName || fullName,
        phone,
        secondaryPhone,
        email: email || `${phone.replace(/\D/g, "")}@tulip-client.dz`,
        password,
        wilayaCode,
        wilayaName,
        commune,
        deliveryAddress,
        notes,
        autoApprove,
      });

      // Trigger Telegram notification for new Access Request
      let telegramStatus: any = null;
      try {
        telegramStatus = await sendTelegramAccessRequestNotification({
          fullName,
          companyName,
          phone,
          secondaryPhone,
          email: email || `${phone.replace(/\D/g, "")}@tulip-client.dz`,
          wilayaCode,
          wilayaName,
          commune,
          deliveryAddress,
          notes,
          createdAt: new Date().toISOString(),
          status: autoApprove ? 'approved' : 'pending',
        });
      } catch (tgErr: any) {
        console.warn("[Telegram Bot] Access request notification error:", tgErr?.message);
      }

      res.status(201).json({
        success: true,
        message: "Compte client créé avec succès !",
        customer: user,
        application,
        telegram: telegramStatus,
      });
    } catch (err: any) {
      console.error("[API] POST /api/auth/register error:", err);
      res.status(500).json({ error: "Erreur lors de la création du compte client." });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: "Identifiant requis." });
      }

      const result = storeDb.authenticateCustomer(identifier, password);
      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: result.error || "Identifiants incorrects.",
          status: result.status,
        });
      }

      res.json({
        success: true,
        customer: result.user,
      });
    } catch (err: any) {
      console.error("[API] POST /api/auth/login error:", err);
      res.status(500).json({ error: "Erreur lors de la tentative de connexion." });
    }
  });

  app.get("/api/customers", (_req, res) => {
    try {
      const data = storeDb.getCustomersData();
      res.json({ success: true, ...data });
    } catch (err: any) {
      console.error("[API] GET /api/customers error:", err);
      res.status(500).json({ error: "Impossible de récupérer les clients." });
    }
  });

  app.post("/api/customers/approve", (req, res) => {
    try {
      const { applicationId, assignedUsername, assignedPassword, verificationNotes } = req.body;
      if (!applicationId || !assignedUsername || !assignedPassword) {
        return res.status(400).json({ error: "Données d'approbation incomplètes." });
      }

      const user = storeDb.approveCustomerApplication(
        applicationId,
        assignedUsername,
        assignedPassword,
        verificationNotes
      );

      if (!user) {
        return res.status(404).json({ error: "Demande introuvable." });
      }

      res.json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] POST /api/customers/approve error:", err);
      res.status(500).json({ error: "Erreur lors de l'approbation." });
    }
  });

  app.patch("/api/customers/:id/status", (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = storeDb.updateCustomerStatus(id, status);
      res.json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] PATCH /api/customers/:id/status error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut client." });
    }
  });

  app.patch("/api/customers/:id/reset-password", (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ error: "Nouveau mot de passe requis." });
      }

      const user = storeDb.resetCustomerPassword(id, newPassword);
      res.json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] PATCH /api/customers/:id/reset-password error:", err);
      res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe." });
    }
  });

  app.post("/api/customers/create-direct", (req, res) => {
    try {
      const user = storeDb.createDirectCustomer(req.body);
      res.status(201).json({ success: true, customer: user });
    } catch (err: any) {
      console.error("[API] POST /api/customers/create-direct error:", err);
      res.status(500).json({ error: "Erreur lors de la création directe du client." });
    }
  });

  app.post("/api/customers/import", (req, res) => {
    try {
      const { customers, replaceExisting } = req.body;
      if (!Array.isArray(customers)) {
        return res.status(400).json({ error: "Liste de clients requise." });
      }
      const result = storeDb.importCustomers(customers, Boolean(replaceExisting));
      res.json({
        success: true,
        count: result.users.length,
        customerUsers: result.users,
        customerApplications: result.applications,
      });
    } catch (err: any) {
      console.error("[API] POST /api/customers/import error:", err);
      res.status(500).json({ error: "Erreur lors de l'importation des clients." });
    }
  });

  app.post("/api/restore", (req, res) => {
    try {
      const { backup } = req.body;
      if (!backup || typeof backup !== "object") {
        return res.status(400).json({ error: "Données de sauvegarde requises." });
      }
      const restored = storeDb.restoreDatabase(backup);
      res.json({
        success: true,
        message: "Restauration effectuée avec succès.",
        data: {
          products: restored.products,
          orders: restored.orders,
          customerApplications: restored.customerApplications,
          customerUsers: restored.customerUsers,
          storeSettings: restored.storeSettings,
          adBanners: restored.adBanners,
          lastUpdated: restored.lastUpdated,
        },
      });
    } catch (err: any) {
      console.error("[API] POST /api/restore error:", err);
      res.status(500).json({ error: "Erreur lors de la restauration du site." });
    }
  });

  app.put("/api/orders", (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Tableau de commandes attendu." });
      }
      const result = storeDb.syncOrders(orders);
      res.json({ success: true, count: result.orders.length, orders: result.orders, updatedProducts: result.updatedProducts });
    } catch (err: any) {
      console.error("[API] PUT /api/orders error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation des commandes." });
    }
  });

  app.delete("/api/customers/:id", (req, res) => {
    try {
      const { id } = req.params;
      storeDb.deleteCustomer(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] DELETE /api/customers/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la suppression." });
    }
  });

  // ---------------- PRODUCTS & INVENTORY ----------------
  app.get("/api/products", (_req, res) => {
    try {
      const products = storeDb.getProducts();
      res.json({ success: true, products });
    } catch (err: any) {
      console.error("[API] GET /api/products error:", err);
      res.status(500).json({ error: "Impossible de récupérer les produits." });
    }
  });

  app.post("/api/products/sync", (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: "Liste de produits requise." });
      }

      const updated = storeDb.syncProducts(products);
      res.json({ success: true, count: updated.length, products: updated });
    } catch (err: any) {
      console.error("[API] POST /api/products/sync error:", err);
      res.status(500).json({ error: "Erreur lors de la synchronisation du catalogue." });
    }
  });

  app.patch("/api/products/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { stock, priceDA, isHidden } = req.body;
      const updated = storeDb.updateSingleProduct(id, stock, priceDA, isHidden);
      if (!updated) {
        return res.status(404).json({ error: "Produit introuvable." });
      }
      res.json({ success: true, product: updated });
    } catch (err: any) {
      console.error("[API] PATCH /api/products/:id error:", err);
      res.status(500).json({ error: "Erreur lors de la mise à jour du produit." });
    }
  });

  // ---------------- BANNERS & SETTINGS ----------------
  app.get("/api/banners", (_req, res) => {
    try {
      res.json({ success: true, banners: storeDb.getBanners() });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des bannières." });
    }
  });

  app.put("/api/banners", (req, res) => {
    try {
      const { banners } = req.body;
      if (!Array.isArray(banners)) {
        return res.status(400).json({ error: "Tableau de bannières attendu." });
      }
      const updated = storeDb.updateBanners(banners);
      res.json({ success: true, banners: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la mise à jour des bannières." });
    }
  });

  app.get("/api/settings", (_req, res) => {
    try {
      res.json({ success: true, settings: storeDb.getSettings() });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la récupération des paramètres." });
    }
  });

  app.put("/api/settings", (req, res) => {
    try {
      const { settings } = req.body;
      const updated = storeDb.updateSettings(settings);
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres." });
    }
  });

  // Telegram Notification Endpoint for Finalized Pre-Orders
  app.post("/api/telegram/send-order", async (req, res) => {
    try {
      const { order, telegramPhone = "+213799938399" } = req.body;
      if (!order) {
        return res.status(400).json({ error: "Les détails de la précommande sont requis." });
      }

      const result: any = await sendTelegramOrderNotification(order, telegramPhone);
      return res.json({
        success: true,
        sentViaBot: result.sentViaBot,
        message: result.message,
        botResult: result.deliveryReports || result.botResult,
        directTelegramUrl: result.directTelegramUrl,
        telegramPhone,
      });
    } catch (err: any) {
      console.error("Error in /api/telegram/send-order:", err);
      return res.status(500).json({ error: "Erreur lors du traitement Telegram." });
    }
  });

  // Telegram Integration Status & Recent Bot Subscribers
  app.get("/api/telegram/status", async (_req, res) => {
    try {
      const config = await resolveTelegramConfig();
      let botInfo: any = null;
      let updates: any[] = [];
      let apiError: string | null = null;

      if (config.token) {
        try {
          const meResp = await fetch(`https://api.telegram.org/bot${config.token}/getMe`);
          const meJson = await meResp.json();
          if (meJson.ok) {
            botInfo = meJson.result;
          } else {
            apiError = meJson.description;
          }

          const upResp = await fetch(`https://api.telegram.org/bot${config.token}/getUpdates`);
          const upJson = await upResp.json();
          if (upJson.ok && Array.isArray(upJson.result)) {
            const seen = new Set<string>();
            updates = upJson.result
              .map((u: any) => {
                const msg = u.message || u.channel_post || u.edited_message || u.my_chat_member;
                const cId = msg?.chat?.id ? String(msg.chat.id) : '';
                return {
                  chatId: cId,
                  chatType: msg?.chat?.type,
                  name: msg?.chat?.title || `${msg?.from?.first_name || ''} ${msg?.from?.last_name || ''}`.trim() || 'Utilisateur',
                  username: msg?.chat?.username || msg?.from?.username,
                  text: msg?.text || (msg?.chat?.type === 'group' ? `Groupe: ${msg?.chat?.title || ''}` : ''),
                  date: msg?.date ? new Date(msg.date * 1000).toISOString() : null,
                };
              })
              .filter((u: any) => {
                if (!u.chatId || seen.has(u.chatId)) return false;
                seen.add(u.chatId);
                return true;
              });
          }
        } catch (fetchErr: any) {
          apiError = fetchErr?.message || "Erreur de connexion API Telegram";
        }
      }

      res.json({
        configured: Boolean(config.token && botInfo),
        tokenMasked: config.token ? `${config.token.slice(0, 10)}...` : '',
        activeChats: config.chatIds,
        primaryChatId: config.primaryChatId,
        chatId: config.primaryChatId,
        isChatIdSelfBot: false,
        enabled: config.enabled,
        bot: botInfo,
        subscribers: updates,
        error: apiError,
      });
    } catch (err: any) {
      console.error("[API] GET /api/telegram/status error:", err);
      res.status(500).json({ error: "Erreur lors de la vérification du statut Telegram." });
    }
  });

  // Telegram Test Notification Trigger
  app.post("/api/telegram/test", async (req, res) => {
    try {
      const { chatId: reqChatId, token: reqToken } = req.body;
      const config = await resolveTelegramConfig();
      const activeToken = reqToken || config.token;

      if (!activeToken) {
        return res.status(400).json({ error: "Aucun Token de Bot Telegram configuré." });
      }

      const testTargets = reqChatId ? [String(reqChatId).trim()] : config.chatIds;

      if (!testTargets || testTargets.length === 0) {
        return res.status(400).json({
          error: "Aucun destinataire Telegram configuré.",
        });
      }

      const testHtml =
        `🌸 <b>TEST DE NOTIFICATION - TULIP FRAGRANCE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ <b>Félicitations !</b> Le bot <code>@tulip5661bot</code> est actif et opérationnel.\n` +
        `🔔 Vous recevrez instantanément sur ce canal :\n` +
        `  • 📄 Chaque validation de Facture Proforma\n` +
        `  • 🌸 Chaque nouvelle Précommande confirmée\n` +
        `  • 🔑 Chaque demande d'accès Professionnel (Tarifs Pro)\n` +
        `📅 <i>Date du test : ${new Date().toLocaleString('fr-DZ')}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 <i>Tulip Fragrance Company • Bir El Djir, Oran</i>`;

      const results = [];
      for (const target of testTargets) {
        if (target === BOT_SELF_ID) continue;
        const tgResp = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: target,
            text: testHtml,
            parse_mode: "HTML",
          }),
        });
        const tgJson = await tgResp.json();
        results.push({ target, ok: Boolean(tgJson && tgJson.ok), data: tgJson });
      }

      const anySuccess = results.some((r) => r.ok);
      if (!anySuccess) {
        return res.status(400).json({
          success: false,
          error: "Impossible d'envoyer le message de test sur Telegram.",
          results,
        });
      }

      return res.json({
        success: true,
        message: `Notification test envoyée avec succès à ${results.filter(r => r.ok).length} destinataire(s) Telegram !`,
        results,
      });
    } catch (err: any) {
      console.error("[API] POST /api/telegram/test error:", err);
      return res.status(500).json({ error: "Erreur lors de l'envoi du test Telegram." });
    }
  });

  // Save Telegram Settings
  app.post("/api/telegram/save-settings", (req, res) => {
    try {
      const { telegramChatId, telegramBotToken, telegramNotificationsEnabled } = req.body;
      const db = storeDb.loadDatabase();
      const updatedSettings = {
        ...db.storeSettings,
        ...(telegramChatId !== undefined && { telegramChatId }),
        ...(telegramBotToken !== undefined && { telegramBotToken }),
        ...(telegramNotificationsEnabled !== undefined && { telegramNotificationsEnabled }),
      };
      storeDb.updateSettings(updatedSettings);
      return res.json({ success: true, settings: updatedSettings });
    } catch (err: any) {
      console.error("[API] POST /api/telegram/save-settings error:", err);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres Telegram." });
    }
  });

  // Vite & Standalone HTTP Server Setup
  async function startServer() {
    if (process.env.VERCEL) {
      return;
    }

    const server = http.createServer(app);

    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const isHmrDisabled = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: isHmrDisabled ? false : { server },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Tulip Fragrance Company server running on http://0.0.0.0:${PORT}`);
    });
  }

  if (!process.env.VERCEL) {
    startServer().catch((err) => {
      console.error("Failed to start server:", err);
    });
  }

  export default app;
