import { useMemo, useState } from 'react';
import { Download, MoreVertical, Plus, Share, X } from 'lucide-react';
import { detectPlatform, useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { KEYS, read, write } from '../lib/storage.js';

const SNOOZE_MS = 14 * 86_400_000;

const Key = ({ children }) => (
  <span className="inline-flex items-center gap-1 border border-line-strong px-1.5 py-0.5 font-semibold text-white">
    {children}
  </span>
);

function Instructions({ platform }) {
  switch (platform) {
    case 'ios-safari':
      return (
        <>Tap <Key><Share size={12} aria-hidden /> Share</Key> then <Key><Plus size={12} aria-hidden /> Add to Home Screen</Key></>
      );
    case 'ios-other':
      return (
        <>Open the <Key><Share size={12} aria-hidden /> Share</Key> menu, then <Key>Add to Home Screen</Key></>
      );
    case 'android':
      return (
        <>Open the browser menu <Key><MoreVertical size={12} aria-hidden /></Key> then <Key>Install app</Key></>
      );
    case 'mac-safari':
      return <>In the menu bar choose <Key>File</Key> → <Key>Add to Dock</Key></>;
    case 'desktop-firefox':
      return <>Firefox can't install apps — open this page in Chrome, Edge or Safari to install.</>;
    default:
      return <>Use the <Key><Download size={12} aria-hidden /> Install</Key> icon in your browser's address bar.</>;
  }
}

/** Top banner guiding the user to install the PWA, tailored to their platform. */
export function InstallBanner() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const platform = useMemo(detectPlatform, []);
  const [dismissedAt, setDismissedAt] = useState(() => read(KEYS.installDismissed, 0));

  if (installed || Date.now() - dismissedAt < SNOOZE_MS) return null;

  const dismiss = () => {
    const t = Date.now();
    write(KEYS.installDismissed, t);
    setDismissedAt(t);
  };

  return (
    <div role="region" aria-label="Install app" className="pt-safe border-b border-line bg-ink">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <img src="/icons/icon-192.png" alt="" className="size-8 shrink-0 border border-line-strong" />
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
          <p className="font-bold uppercase tracking-[0.14em] text-white">Install DISCIPLEX</p>
          <p className="mt-0.5">
            {canPrompt ? 'Full-screen, works offline, one tap from your home screen.' : <Instructions platform={platform} />}
          </p>
        </div>
        {canPrompt && (
          <button type="button" onClick={promptInstall} className="btn-primary shrink-0 px-3 py-2">
            <Download size={14} aria-hidden /> Install
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss install banner" className="shrink-0 p-1.5 text-muted hover:text-white">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
