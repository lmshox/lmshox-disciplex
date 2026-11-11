import { Check, Clock, Flame, X } from 'lucide-react';
import { formatCountdown, formatInstant } from '../lib/format.js';

const HOUR = 3_600_000;
const QUARTER = 15 * 60_000;

function Status({ item, now, queued, timeZone }) {
  if (item.status === 'done') {
    return <span className="text-ok">Done {item.resolvedAt && formatInstant(item.resolvedAt, timeZone)}</span>;
  }
  if (item.status === 'failed') return <span className="font-bold text-alert">Failed</span>;
  if (queued) return <span className="text-warn">Queued · offline</span>;
  const left = item.deadlineAt - now;
  if (left <= 0) return <span className="animate-alert font-bold text-alert">Failing…</span>;
  const tone = left <= QUARTER ? 'text-alert animate-alert' : left <= HOUR ? 'text-warn' : 'text-muted';
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <Clock size={11} aria-hidden /> {formatCountdown(left)} left
    </span>
  );
}

export function TaskRow({ item, now, queued, timeZone, onComplete }) {
  const expired = item.status === 'pending' && item.deadlineAt <= now;
  const actionable = item.status === 'pending' && !expired && !queued;
  const done = item.status === 'done';
  const failed = item.status === 'failed' || expired;

  const box = done
    ? 'border-white bg-white text-black'
    : failed
      ? 'border-alert bg-alert text-black'
      : queued
        ? 'border-dashed border-warn text-warn'
        : 'border-white text-transparent hover:bg-white/10';

  return (
    <li className={`flex items-start gap-3 px-4 py-3.5 ${failed ? 'bg-alert/[0.06]' : ''}`}>
      <button
        type="button"
        disabled={!actionable}
        onClick={() => onComplete(item.id)}
        aria-label={actionable ? `Mark "${item.title}" done` : `${item.title}: ${item.status}`}
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center border-2 transition-colors disabled:cursor-default ${box}`}
      >
        {failed ? <X size={16} strokeWidth={3} /> : <Check size={16} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`truncate text-sm font-semibold ${failed ? 'text-alert' : done ? 'text-muted' : 'text-white'}`}>
            {item.title}
          </p>
          <span className="shrink-0 font-mono text-sm font-bold">{formatInstant(item.deadlineAt, timeZone)}</span>
        </div>
        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.description}</p>}
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wider">
          <Status item={item} now={now} queued={queued} timeZone={timeZone} />
          {item.streak > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-white" title="Consecutive completions">
              <Flame size={12} aria-hidden className="text-warn" /> {item.streak}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
