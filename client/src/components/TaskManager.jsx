import { useEffect, useState } from 'react';
import { Archive, Flame, Lock, Pencil } from 'lucide-react';
import { describeDays, formatClock } from '../lib/format.js';
import { TaskForm } from './TaskForm.jsx';

function ArchiveButton({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return armed ? (
    <button type="button" onClick={onConfirm} className="btn-danger px-2 py-1 text-[10px]">Confirm</button>
  ) : (
    <button type="button" onClick={() => setArmed(true)} aria-label="Archive task" className="p-1.5 text-muted hover:text-alert">
      <Archive size={15} />
    </button>
  );
}

export function TaskManager({ tasks, lock, online, onCreate, onUpdate, onArchive, notify }) {
  const [editing, setEditing] = useState(null);
  const blocked = lock.accountabilityRequired;
  const disabled = blocked || !online;

  const archive = async (task) => {
    try {
      await onArchive(task.id);
      notify('info', `Archived "${task.title}". Today's occurrence still counts.`);
    } catch (err) {
      notify('alert', err.message);
    }
  };

  return (
    <div className="space-y-4">
      {blocked && (
        <div className="flex items-center gap-2 border border-alert px-4 py-3 text-xs font-semibold text-alert">
          <Lock size={14} aria-hidden /> Task changes are locked until your accountability log is filed.
        </div>
      )}
      {!online && !blocked && (
        <p className="border border-warn px-4 py-3 text-xs font-semibold text-warn">Task changes need a connection.</p>
      )}

      {editing ? (
        <TaskForm
          key={editing.id}
          initial={editing}
          disabled={disabled}
          onSubmit={async (data) => {
            await onUpdate(editing.id, data);
            setEditing(null);
            notify('ok', 'Task updated. Changes apply from the next occurrence.');
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <TaskForm
          disabled={disabled}
          onSubmit={async (data) => {
            await onCreate(data);
            notify('ok', `Committed: "${data.title}".`);
          }}
        />
      )}

      <section aria-label="Active tasks" className="border border-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em]">Active tasks</h2>
          <span className="font-mono text-xs text-muted">{tasks.length}</span>
        </div>
        {tasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No tasks yet. Commit to your first one above.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.18em] text-muted">
                <th className="px-4 py-2 font-semibold">Task</th>
                <th className="hidden px-2 py-2 font-semibold sm:table-cell">Frequency</th>
                <th className="px-2 py-2 text-right font-semibold">Due</th>
                <th className="px-2 py-2 text-right font-semibold"><span className="sr-only">Streak</span><Flame size={11} aria-hidden className="ml-auto" /></th>
                <th className="w-20 px-2 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((t) => (
                <tr key={t.id} className={editing?.id === t.id ? 'bg-white/5' : ''}>
                  <td className="max-w-0 px-4 py-3">
                    <p className="truncate font-semibold">{t.title}</p>
                    <p className="truncate text-[11px] text-muted sm:hidden">{describeDays(t.daysMask)}</p>
                    {t.description && <p className="hidden truncate text-[11px] text-muted sm:block">{t.description}</p>}
                  </td>
                  <td className="hidden px-2 py-3 text-xs text-muted sm:table-cell">{describeDays(t.daysMask)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-xs font-bold">{formatClock(t.deadlineTime)}</td>
                  <td className="px-2 py-3 text-right font-mono text-xs">{t.streak}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setEditing(t)}
                        aria-label={`Edit ${t.title}`}
                        className="p-1.5 text-muted hover:text-white disabled:opacity-30"
                      >
                        <Pencil size={15} />
                      </button>
                      {!disabled && <ArchiveButton onConfirm={() => archive(t)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
