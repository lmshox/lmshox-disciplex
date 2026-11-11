import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

const TYPE = {
  failed: { label: 'Fail', cls: 'bg-alert text-black' },
  completed: { label: 'Done', cls: 'bg-white text-black' },
  lockout: { label: 'Lock', cls: 'border border-alert text-alert' },
  accountability: { label: 'Log', cls: 'border border-white text-white' },
  task_created: { label: 'New', cls: 'border border-line-strong text-muted' },
  task_archived: { label: 'Arch', cls: 'border border-line-strong text-muted' },
};

export function HistoryLog({ version, online }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.history().then(
      (d) => !cancelled && (setData(d), setError(null)),
      (err) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [version, online]);

  if (!data) {
    return <p className="border border-line px-4 py-8 text-center text-sm text-muted">{error ?? 'Loading log…'}</p>;
  }

  return (
    <div className="space-y-4">
      <section aria-label="Event log" className="border border-line">
        <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-[0.2em]">Event log</h2>
        {data.events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No events yet.</p>
        ) : (
          <ol className="divide-y divide-line">
            {data.events.map((e) => {
              const t = TYPE[e.type] ?? TYPE.task_created;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-0.5 w-11 shrink-0 py-0.5 text-center text-[9px] font-black uppercase tracking-widest ${t.cls}`}>
                    {t.label}
                  </span>
                  <p className={`flex-1 text-xs leading-relaxed ${e.type === 'failed' || e.type === 'lockout' ? 'text-alert' : ''}`}>
                    {e.message}
                  </p>
                  <div className="shrink-0 text-right font-mono text-[10px] text-muted">
                    <div>{formatDateTime(e.createdAt)}</div>
                    {e.scoreDelta !== 0 && (
                      <div className={e.scoreDelta < 0 ? 'text-alert' : 'text-ok'}>
                        {e.scoreDelta > 0 ? '+' : ''}{e.scoreDelta}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {data.accountability.length > 0 && (
        <section aria-label="Accountability logs" className="border border-line">
          <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-[0.2em]">Accountability logs</h2>
          <ol className="divide-y divide-line">
            {data.accountability.map((l) => (
              <li key={l.id} className="space-y-2 px-4 py-3 text-xs">
                <div className="flex justify-between font-mono text-[10px] text-muted">
                  <span className="text-alert">{l.strikesInCycle} strikes · {l.strikesTotal} total</span>
                  <span>{formatDateTime(l.createdAt)}</span>
                </div>
                <dl className="space-y-1.5">
                  {[['What happened', l.failureSummary], ['Root cause', l.rootCause], ['Corrective action', l.correctiveAction]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="label">{k}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
