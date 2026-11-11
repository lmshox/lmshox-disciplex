import { TaskRow } from './TaskRow.jsx';

export function TodayChecklist({ items, now, queued, timeZone, onComplete, onAddTask }) {
  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  const dateLabel = new Date(now).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone });

  return (
    <section aria-label="Today's checklist" className="border border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em]">Today</h2>
          <p className="text-[11px] text-muted">{dateLabel}</p>
        </div>
        <div className="text-right font-mono text-sm">
          <span className="font-bold">{done}</span>
          <span className="text-muted">/{items.length}</span>
          {failed > 0 && <span className="ml-2 text-alert">{failed}✕</span>}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-muted">Nothing scheduled for today.</p>
          <button type="button" onClick={onAddTask} className="btn-ghost">Create a task</button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <TaskRow
              key={item.id}
              item={item}
              now={now}
              timeZone={timeZone}
              queued={queued.includes(item.id)}
              onComplete={onComplete}
            />
          ))}
        </ul>
      )}
      <p className="border-t border-line px-4 py-2 text-[10px] uppercase tracking-widest text-muted">
        Completion is final · Missed deadline = FAILED + strike
      </p>
    </section>
  );
}
