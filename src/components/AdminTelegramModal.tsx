import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Zap,
  Info,
  X,
  Bot,
} from 'lucide-react';
import { StoreSettings } from '../types';
import {
  fetchTelegramStatus,
  triggerTelegramTest,
  saveTelegramSettings,
  TelegramStatusResponse,
} from '../utils/api';

interface AdminTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeSettings: StoreSettings;
  onUpdateSettings?: (newSettings: StoreSettings) => void;
}

export const AdminTelegramModal: React.FC<AdminTelegramModalProps> = ({
  isOpen,
  onClose,
  storeSettings,
  onUpdateSettings,
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [chatId, setChatId] = useState(storeSettings.telegramChatId || '');
  const [botToken, setBotToken] = useState(storeSettings.telegramBotToken || '8908435035:AAFYIq74hxJeFeiQAPRx_g_WZ7R5fL0uwu8');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    storeSettings.telegramNotificationsEnabled !== false
  );

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetchTelegramStatus();
      setStatus(res);
      if (res.chatId && !chatId) {
        setChatId(res.chatId);
      }
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestNotification = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await triggerTelegramTest(chatId, botToken);
      if (res.success) {
        setTestResult({
          success: true,
          message: 'Notification de test reçue avec succès sur votre Telegram !',
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Échec de l’envoi de la notification.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erreur réseau.',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const res = await saveTelegramSettings({
        telegramChatId: chatId.trim(),
        telegramBotToken: botToken.trim(),
        telegramNotificationsEnabled: notificationsEnabled,
      });
      if (res.success) {
        setSaveSuccess(true);
        if (onUpdateSettings) {
          onUpdateSettings({
            ...storeSettings,
            telegramChatId: chatId.trim(),
            telegramBotToken: botToken.trim(),
            telegramNotificationsEnabled: notificationsEnabled,
          });
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isSelfBotId = chatId.trim() === '8908435035';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Notifications Telegram Bot</h3>
                {status?.bot ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En Ligne
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-semibold border border-amber-500/30">
                    Configuration
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Recevez instantanément chaque précommande passée sur votre boutique Tulip
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Bot Info Card */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{status?.bot?.first_name || 'Tulip Fragrance Bot'}</span>
                  <span className="text-xs font-mono text-sky-400">@{status?.bot?.username || 'tulip5661bot'}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>ID Bot : {status?.bot?.id || '8908435035'}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">Connecté & Opérationnel</span>
                </div>
              </div>
            </div>

            <a
              href={`https://t.me/${status?.bot?.username || 'tulip5661bot'}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-2 transition shrink-0 shadow-sm"
            >
              <span>Ouvrir @{status?.bot?.username || 'tulip5661bot'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Active Notifications Badges */}
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2.5">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Événements transmis automatiquement sur Telegram :
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center text-xs font-bold shrink-0">
                  🌸
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200">Précommandes</div>
                  <div className="text-[10px] text-emerald-400">Envoi immédiat</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                  📄
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200">Factures Proforma</div>
                  <div className="text-[10px] text-emerald-400">Envoi immédiat</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold shrink-0">
                  🔑
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200">Demandes Accès Pro</div>
                  <div className="text-[10px] text-emerald-400">Envoi immédiat</div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  Destinataires Telegram (Chat ID ou Groupe)
                </label>
                <button
                  type="button"
                  onClick={loadStatus}
                  disabled={loading}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Actualiser les canaux
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Ex: -5365585827 (groupe commande) ou 5680755596 (compte admin)"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-sky-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Laissez vide ou séparez par des virgules pour diffuser à la fois au groupe <b>commande (-5365585827)</b> et à votre compte personnel <b>(5680755596)</b>.
              </p>

              {isSelfBotId && (
                <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <b>Note :</b> <code>8908435035</code> est l&apos;ID du bot lui-même. Le système transmet automatiquement les messages à votre groupe <b>commande (-5365585827)</b> et compte admin.
                  </div>
                </div>
              )}
            </div>

            {/* Detected Recent Subscribers (1-Click Select) */}
            {status?.subscribers && status.subscribers.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  Canaux et contacts détectés connectés au bot :
                </div>
                <div className="space-y-1.5">
                  {status.subscribers.map((sub) => (
                    <div
                      key={sub.chatId}
                      className="p-2 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{sub.name}</span>
                          {sub.chatType === 'group' && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                              Groupe Telegram
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-sky-400 block">ID: {sub.chatId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChatId(sub.chatId)}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-semibold border border-sky-500/30 transition cursor-pointer"
                      >
                        Sélectionner
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notification Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Envoi automatique en temps réel
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Diffuser instantanément chaque précommande, proforma et demande d&apos;accès pro
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 cursor-pointer ${
                  notificationsEnabled ? 'bg-sky-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1">{testResult.message}</div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Paramètres Telegram enregistrés avec succès !
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={testLoading || !chatId || isSelfBotId}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
          >
            <Send className={`w-3.5 h-3.5 ${testLoading ? 'animate-pulse' : ''}`} />
            <span>{testLoading ? 'Envoi du test...' : 'Envoyer un message de test'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
