import { useCallback, useEffect, useState } from 'react';

// Captured at module load so the event is never missed before React mounts.
let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

/** Coarse platform detection, used only to choose install instructions. */
export function detectPlatform() {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) {
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (/Android/.test(ua)) return 'android';
  if (/^((?!chrome|android|crios|fxios).)*safari/i.test(ua)) return 'mac-safari';
  if (/Firefox/.test(ua)) return 'desktop-firefox';
  return 'desktop';
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const update = () => {
      force((n) => n + 1);
      setInstalled(isStandalone());
    };
    listeners.add(update);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', update);
    return () => {
      listeners.delete(update);
      mq?.removeEventListener?.('change', update);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    emit();
    return outcome;
  }, []);

  return { canPrompt: Boolean(deferredPrompt), installed, promptInstall };
}
