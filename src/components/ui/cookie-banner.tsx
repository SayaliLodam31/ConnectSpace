'use client';

import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Settings, Check, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CookiePreferences {
  essential: true; // Always true
  functional: boolean;
  analytics: boolean;
  consentedAt: string;
  version: number;
}

const STORAGE_KEY = 'connectspace_cookie_consent_v1';
const POLICY_VERSION = 1;

export function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: true,
    analytics: false,
    consentedAt: '',
    version: POLICY_VERSION,
  });

  useEffect(() => {
    // Check existing consent
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CookiePreferences;
        if (parsed.version === POLICY_VERSION) {
          setPreferences(parsed);
          setIsOpen(false);
        } else {
          setIsOpen(true);
        }
      } else {
        // Small delay so page transition finishes smoothly
        const timer = setTimeout(() => setIsOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      setIsOpen(true);
    }

    // Global listener to reopen settings
    const handleReopen = () => {
      setShowSettingsModal(true);
      setIsOpen(true);
    };

    window.addEventListener('open-cookie-settings', handleReopen);
    return () => window.removeEventListener('open-cookie-settings', handleReopen);
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    const updated = {
      ...prefs,
      essential: true as const,
      consentedAt: new Date().toISOString(),
      version: POLICY_VERSION,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setPreferences(updated);
    setIsOpen(false);
    setShowSettingsModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      essential: true,
      functional: true,
      analytics: true,
      consentedAt: '',
      version: POLICY_VERSION,
    });
  };

  const handleRejectOptional = () => {
    saveConsent({
      essential: true,
      functional: false,
      analytics: false,
      consentedAt: '',
      version: POLICY_VERSION,
    });
  };

  const handleSaveCustom = () => {
    saveConsent(preferences);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Cookie Banner Bar */}
      <div
        role="region"
        aria-label="Cookie consent banner"
        className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none"
      >
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl p-4 sm:p-5 pointer-events-auto animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-900 text-sm mb-0.5">
                  Your Privacy &amp; Essential Cookies
                </p>
                ConnectSpace uses essential authentication and session cookies to ensure secure logins, meeting access, and real-time collaboration. Optional cookies help remember your device preferences. We never sell your personal data.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsModal(true)}
                className="text-xs"
              >
                <Settings className="w-3.5 h-3.5 mr-1" />
                Cookie Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectOptional}
                className="text-xs"
              >
                Reject Optional
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAcceptAll}
                className="text-xs shadow-sm shadow-blue-600/20"
              >
                Accept All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Customization Modal */}
      {showSettingsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-settings-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="cookie-settings-title" className="text-base font-bold text-slate-900">
                    Cookie &amp; Privacy Preferences
                  </h3>
                  <p className="text-[11px] text-slate-500">Configure how ConnectSpace uses cookies</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close cookie settings"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Essential Cookies */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">Strictly Essential Cookies</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                      Always Active
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Required for Supabase Auth tokens, cryptographic CSRF verification, session continuity across page refreshes, and WebRTC meeting signaling.
                  </p>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-900">Functional &amp; Device Preferences</span>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Remembers device choices such as your camera/microphone selection, layout view, and UI preferences between sessions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label="Toggle functional cookies"
                  checked={preferences.functional}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, functional: e.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Analytics */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-900">Performance &amp; Diagnostics</span>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Collects anonymous operational diagnostics on WebRTC connection latency and audio/video packet quality to prevent dropped calls.
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label="Toggle analytics cookies"
                  checked={preferences.analytics}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, analytics: e.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={handleRejectOptional}>
                Reject Optional
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveCustom}>
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Utility helper for components to reopen the Cookie Settings modal
 */
export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-cookie-settings'));
  }
}
