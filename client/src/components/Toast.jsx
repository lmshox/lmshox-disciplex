import { useEffect } from 'react';
import { X } from 'lucide-react';

const TONE = {
  alert: 'border-alert text-alert',
  warn: 'border-warn text-warn',
  ok: 'border-ok text-ok',
  info: 'border-white text-white',
};

export function Toast({ notice, onDismiss, action }) {
  useEffect(() => {
    if (!notice || action) return;
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [notice, onDismiss, action]);

  if (!notice) return null;
  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4">
      <div
        role={notice.kind === 'alert' ? 'alert' : 'status'}
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 border bg-ink px-4 py-3 text-xs font-semibold ${TONE[notice.kind] ?? TONE.info}`}
      >
        <span className="flex-1">{notice.message}</span>
        {action}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-muted hover:text-white">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
