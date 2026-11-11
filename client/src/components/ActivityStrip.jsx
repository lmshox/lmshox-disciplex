import { DAY_LABELS } from '../lib/format.js';

function cellClass(d) {
  if (d.failed > 0) return 'bg-alert';
  if (d.pending > 0) return 'border border-white';
  if (d.done > 0) return 'bg-white';
  return 'bg-line';
}

function describe(d) {
  if (!d.done && !d.failed && !d.pending) return `${d.date}: no tasks`;
  return `${d.date}: ${d.done} done, ${d.failed} failed${d.pending ? `, ${d.pending} pending` : ''}`;
}

/** Last 14 days at a glance: white = clean day, red = any failure, outline = in progress. */
export function ActivityStrip({ days }) {
  return (
    <section aria-label="Last 14 days" className="border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Last 14 days</span>
        <span className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted">
          <span className="flex items-center gap-1"><i className="block size-2 bg-white" /> Clean</span>
          <span className="flex items-center gap-1"><i className="block size-2 bg-alert" /> Failed</span>
        </span>
      </div>
      <ol className="grid grid-cols-14 gap-1">
        {days.map((d) => {
          const [y, m, day] = d.date.split('-').map(Number);
          const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
          return (
            <li key={d.date} className="flex flex-col items-center gap-1" title={describe(d)}>
              <span className={`block aspect-square w-full ${cellClass(d)}`} aria-label={describe(d)} />
              <span className="font-mono text-[9px] text-muted">{DAY_LABELS[dow]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
