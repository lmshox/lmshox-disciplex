import { CloudOff, LogOut, RefreshCw } from 'lucide-react';

export function AppHeader({ username, online, stale, queuedCount, onRefresh, onLogout }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block size-2.5 bg-alert" />
          <span className="text-sm font-black tracking-[0.3em]">DISCIPLEX</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {!online ? (
            <span className="flex items-center gap-1.5 border border-warn px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-warn">
              <CloudOff size={12} aria-hidden /> Offline{queuedCount ? ` · ${queuedCount} queued` : ''}
            </span>
          ) : stale ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Syncing…</span>
          ) : null}
          <button type="button" onClick={onRefresh} aria-label="Refresh" className="p-2 text-muted hover:text-white">
            <RefreshCw size={16} />
          </button>
          <span className="hidden max-w-32 truncate px-2 font-mono text-xs text-muted sm:inline">{username}</span>
          <button type="button" onClick={onLogout} aria-label="Sign out" className="p-2 text-muted hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
