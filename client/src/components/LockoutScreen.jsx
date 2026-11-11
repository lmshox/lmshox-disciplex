import { Lock, LogOut } from 'lucide-react';
import { formatCountdown } from '../lib/format.js';
import { AccountabilityForm } from './AccountabilityForm.jsx';
import { TaskRow } from './TaskRow.jsx';

/**
 * Full-screen gate shown once the strike threshold is hit.
 * Phase 1: timed lockout. Phase 2: mandatory accountability log.
 * Pending tasks remain completable throughout so the lockout can't cascade into new failures.
 */
export function LockoutScreen({ lock, stats, today, now, queued, timeZone, online, onComplete, onSubmit, onLogout }) {
  const remaining = Math.max(0, (lock.lockedUntil ?? 0) - now);
  const timed = lock.locked && remaining > 0;
  const pending = today.filter((t) => t.status === 'pending' && t.deadlineAt > now);

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="lock-title" className="fixed inset-0 z-40 overflow-y-auto bg-black">
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)] pt-[max(env(safe-area-inset-top),2.5rem)] text-center">
        <div className="mb-6 flex size-16 items-center justify-center border-2 border-alert text-alert">
          <Lock size={28} strokeWidth={2.5} aria-hidden />
        </div>
        <p className="label text-alert">Strike threshold reached · {lock.strikesInCycle}/{lock.threshold}</p>
        <h1 id="lock-title" className="mt-2 text-3xl font-black uppercase tracking-tight">
          {timed ? 'System locked' : 'Accountability required'}
        </h1>

        {timed ? (
          <>
            <p className="mt-3 max-w-sm text-sm text-muted">
              You missed {lock.strikesInCycle} deadlines. Sit with it. Access to task management resumes after the timer — and a written log.
            </p>
            <div className="my-8 font-mono text-6xl font-bold tabular-nums text-alert sm:text-7xl" aria-live="off">
              {formatCountdown(remaining)}
            </div>
          </>
        ) : (
          <p className="mb-8 mt-3 max-w-sm text-sm text-muted">
            Lockout served. Before new tasks can be created, file an honest account of what went wrong.
          </p>
        )}

        <dl className="mb-8 grid w-full grid-cols-3 gap-px border border-line bg-line text-left">
          {[
            ['Score', `${stats.score}`, stats.score < 40 ? 'text-alert' : 'text-white'],
            ['Total strikes', `${stats.strikes}`, 'text-alert'],
            ['Next lockout', `${lock.nextLockoutMinutes}m`, 'text-white'],
          ].map(([k, v, tone]) => (
            <div key={k} className="bg-black p-3">
              <dt className="label">{k}</dt>
              <dd className={`mt-1 font-mono text-xl font-bold ${tone}`}>{v}</dd>
            </div>
          ))}
        </dl>

        {!timed && <AccountabilityForm onSubmit={onSubmit} online={online} />}

        {pending.length > 0 && (
          <section className="mt-8 w-full border border-line text-left" aria-label="Tasks still due">
            <h2 className="border-b border-line px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-warn">
              Still due today — deadlines don't pause
            </h2>
            <ul className="divide-y divide-line">
              {pending.map((item) => (
                <TaskRow key={item.id} item={item} now={now} timeZone={timeZone} queued={queued.includes(item.id)} onComplete={onComplete} />
              ))}
            </ul>
          </section>
        )}

        <button type="button" onClick={onLogout} className="mt-10 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted hover:text-white">
          <LogOut size={14} aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}
