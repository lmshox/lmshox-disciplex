import { useState } from 'react';

const MIN = 20;
const FIELDS = [
  { key: 'failureSummary', label: 'What happened', hint: 'Which tasks did you fail, and when?' },
  { key: 'rootCause', label: 'Root cause', hint: 'The real reason. No excuses — causes.' },
  { key: 'correctiveAction', label: 'Corrective action', hint: 'What specifically changes starting today?' },
];

export function AccountabilityForm({ onSubmit, online }) {
  const [values, setValues] = useState({ failureSummary: '', rootCause: '', correctiveAction: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const complete = FIELDS.every((f) => values[f.key].trim().length >= MIN);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full space-y-4 text-left">
      {FIELDS.map((f, i) => {
        const len = values[f.key].trim().length;
        return (
          <label key={f.key} className="block space-y-1.5">
            <span className="flex items-baseline justify-between">
              <span className="label text-white">{i + 1}. {f.label}</span>
              <span className={`font-mono text-[10px] ${len >= MIN ? 'text-ok' : 'text-muted'}`}>{Math.min(len, MIN)}/{MIN}</span>
            </span>
            <textarea
              className="field min-h-20 resize-y"
              placeholder={f.hint}
              value={values[f.key]}
              maxLength={1000}
              required
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        );
      })}
      {error && <p role="alert" className="text-xs font-semibold text-alert">{error}</p>}
      {!online && <p className="text-xs font-semibold text-warn">Reconnect to file your log.</p>}
      <button type="submit" className="btn-primary w-full" disabled={!complete || busy || !online}>
        {busy ? 'Filing…' : 'File log & restore access'}
      </button>
    </form>
  );
}
