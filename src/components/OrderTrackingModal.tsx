import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Package,
  Calendar,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Download,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PreOrder, CustomerUser, StoreSettings } from '../types';
import { formatDZD, downloadOrderPDF } from '../utils/pdfGenerator';
import { AppLanguage, translations } from '../translations';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PreOrder[];
  currentCustomer: CustomerUser | null;
  storeSettings: StoreSettings;
  lang: AppLanguage;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  orders,
  currentCustomer,
  storeSettings,
  lang,
}) => {
  const t = translations[lang];
  const [searchInput, setSearchInput] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PreOrder | null>(null);

  // If customer is logged in, show their orders by default
  const customerOrders = useMemo(() => {
    if (!currentCustomer) return [];
    const cleanPhone = currentCustomer.phone.replace(/\D/g, '');
    const cleanEmail = currentCustomer.email.toLowerCase().trim();
    const cleanName = currentCustomer.fullName.toLowerCase().trim();

    return orders.filter((ord) => {
      const ordPhone = ord.customer.phone.replace(/\D/g, '');
      const ordEmail = (ord.customer.email || '').toLowerCase().trim();
      const ordName = ord.customer.fullName.toLowerCase().trim();

      return (
        (cleanPhone && ordPhone.includes(cleanPhone)) ||
        (cleanEmail && ordEmail === cleanEmail) ||
        ordName === cleanName
      );
    });
  }, [orders, currentCustomer]);

  // If user searched for a specific order reference or phone
  const searchResults = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return customerOrders;

    return orders.filter((ord) => {
      const orderNum = ord.orderNumber.toLowerCase();
      const phone = ord.customer.phone.replace(/\D/g, '');
      const client = ord.customer.fullName.toLowerCase();
      const cleanQ = query.replace(/\D/g, '');

      return (
        orderNum.includes(query) ||
        client.includes(query) ||
        (cleanQ && phone.includes(cleanQ))
      );
    });
  }, [orders, searchInput, customerOrders]);

  if (!isOpen) return null;

  const getStatusBadge = (status: PreOrder['status']) => {
    switch (status) {
      case 'en_attente':
        return {
          label: t.statusPending,
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          step: 1,
          icon: Clock,
        };
      case 'confirmee':
        return {
          label: t.statusConfirmed,
          bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          step: 2,
          icon: CheckCircle2,
        };
      case 'en_preparation':
        return {
          label: t.statusInPrep,
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          step: 3,
          icon: Package,
        };
      case 'livree':
        return {
          label: t.statusDelivered,
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          step: 4,
          icon: Truck,
        };
      case 'annulee':
        return {
          label: t.statusCancelled,
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          step: 0,
          icon: AlertCircle,
        };
    }
  };

  const activeOrderToDisplay = selectedOrder || (searchResults.length > 0 ? searchResults[0] : null);

  const handleWhatsAppInquiry = (order: PreOrder) => {
    const text = encodeURIComponent(
      `Bonjour Tulip Fragrance,\n\nJe souhaite suivre l'avancement de ma précommande :\n*Réf :* ${order.orderNumber}\n*Nom :* ${order.customer.fullName}\n*Montant :* ${formatDZD(order.totalDA)}\n\nMerci de me tenir informé.`
    );
    window.open(`https://wa.me/${storeSettings.whatsappPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col text-white my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-fuchsia-700 flex items-center justify-center text-white shadow-md">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {t.trackModalTitle}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t.trackModalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-850 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.trackInputPlaceholder}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {currentCustomer && (
            <div className="mt-2 text-[11px] text-rose-300/80 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span>Connecté en tant que <strong>{currentCustomer.fullName}</strong> ({customerOrders.length} commande(s) associée(s))</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {searchResults.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">
                {t.noOrdersYet}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Veuillez vérifier votre numéro de référence (ex: PRE-2026-...) ou contacter le service commercial.
              </p>
            </div>
          ) : (
            <>
              {/* If multiple orders, show small selector pills */}
              {searchResults.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {searchResults.map((ord) => {
                    const isSelected = activeOrderToDisplay?.id === ord.id;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => setSelectedOrder(ord)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold shrink-0 transition cursor-pointer border ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        {ord.orderNumber}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Display Active Order Card */}
              {activeOrderToDisplay && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  {/* Order Reference & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">
                        RÉFÉRENCE OFFICIELLE
                      </span>
                      <span className="text-base sm:text-lg font-mono font-extrabold text-white">
                        {activeOrderToDisplay.orderNumber}
                      </span>
                    </div>

                    {(() => {
                      const badge = getStatusBadge(activeOrderToDisplay.status);
                      const IconComp = badge.icon;
                      return (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${badge.bg}`}>
                          <IconComp className="w-3.5 h-3.5" />
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Visual Status Stepper */}
                  <div className="py-2">
                    <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center">
                      {[
                        { step: 1, title: 'Reçue', desc: 'Enregistrée' },
                        { step: 2, title: 'Confirmée', desc: 'Stock Bloqué' },
                        { step: 3, title: 'Atelier', desc: 'En Préparation' },
                        { step: 4, title: 'Expédiée', desc: 'Prête / Livrée' },
                      ].map((s) => {
                        const currentStep = getStatusBadge(activeOrderToDisplay.status).step;
                        const isDone = currentStep >= s.step;
                        const isCurrent = currentStep === s.step;

                        return (
                          <div key={s.step} className="flex flex-col items-center">
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition mb-1 ${
                                isDone
                                  ? isCurrent
                                    ? 'bg-rose-600 text-white ring-4 ring-rose-600/30'
                                    : 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700'
                              }`}
                            >
                              {isDone ? '✓' : s.step}
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold leading-tight ${isDone ? 'text-white' : 'text-slate-500'}`}>
                              {s.title}
                            </span>
                            <span className="text-[9px] text-slate-500 hidden sm:block">
                              {s.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Date : {new Date(activeOrderToDisplay.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        <span>{activeOrderToDisplay.customer.wilayaCode} - {activeOrderToDisplay.customer.wilayaName} ({activeOrderToDisplay.customer.commune})</span>
                      </div>
                    </div>

                    <div className="space-y-1 sm:text-right">
                      <div className="text-slate-400">
                        Total Précommandé :
                      </div>
                      <div className="text-base font-extrabold text-rose-400 font-mono">
                        {formatDZD(activeOrderToDisplay.totalDA)}
                      </div>
                    </div>
                  </div>

                  {/* Reserved Items */}
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Articles Réservés ({activeOrderToDisplay.items.length})
                    </h5>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {activeOrderToDisplay.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate mr-2">
                            <span className="font-mono font-bold text-rose-400 shrink-0">
                              {item.family === 'Extrait' ? `${item.quantity}g` : `${item.quantity}x`}
                            </span>
                            <span className="text-slate-200 truncate">{item.name}</span>
                          </div>
                          <span className="font-mono text-slate-300 shrink-0">
                            {formatDZD(item.totalDA)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => downloadOrderPDF(activeOrderToDisplay, storeSettings)}
                      className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.downloadPdfBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppInquiry(activeOrderToDisplay)}
                      className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Contacter sur WhatsApp</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Ligne assistance : {storeSettings.phone} / {storeSettings.phoneSecondary || '0559061552'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-semibold"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
