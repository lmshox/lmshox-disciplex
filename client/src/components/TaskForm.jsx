import { useState } from 'react';
import { DAY_LABELS, DAY_NAMES, PRESETS } from '../lib/format.js';

const EMPTY = { title: '', description: '', deadlineTime: '07:00', daysMask: PRESETS.everyday };

export function TaskForm({ initial, disabled, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial?.id);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleDay = (i) => setForm((f) => ({ ...f, daysMask: f.daysMask ^ (1 << i) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.daysMask) return setError('Select at least one day.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        deadlineTime: form.deadlineTime,
        daysMask: form.daysMask,
      });
      if (!editing) setForm(EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 border border-line p-4" aria-label={editing ? 'Edit task' : 'New task'}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em]">{editing ? 'Edit task' : 'New task'}</h2>
        {editing && <span className="text-[10px] uppercase tracking-widest text-warn">Applies from next occurrence</span>}
      </div>

      <fieldset disabled={disabled || busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <label className="block space-y-1.5">
            <span className="label">Title</span>
            <input className="field" value={form.title} onChange={set('title')} maxLength={80} required placeholder="Cold shower" />
          </label>
          <label className="block space-y-1.5">
            <span className="label">Deadline</span>
            <input className="field font-mono" type="time" value={form.deadlineTime} onChange={set('deadlineTime')} required />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="label">Description</span>
          <textarea
            className="field min-h-16 resize-y"
            value={form.description}
            onChange={set('description')}
            maxLength={500}
            placeholder="Definition of done. Be specific."
          />
        </label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="label" id="days-label">Frequency</span>
            <div className="flex gap-3 text-[10px] font-bold uppercase tracking-widest">
              {Object.entries(PRESETS).map(([name, mask]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, daysMask: mask }))}
                  className={`uppercase ${form.daysMask === mask ? 'text-white underline underline-offset-4' : 'text-muted hover:text-white'}`}
                >
                  {name === 'everyday' ? 'Daily' : name}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-labelledby="days-label" className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map((d, i) => {
              const on = Boolean(form.daysMask & (1 << i));
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[i]}
                  onClick={() => toggleDay(i)}
                  className={`border py-2 font-mono text-xs font-bold transition-colors ${
                    on ? 'border-white bg-white text-black' : 'border-line-strong text-muted hover:border-white'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {error && <p role="alert" className="text-xs font-semibold text-alert">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={disabled || busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Commit task'}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}
