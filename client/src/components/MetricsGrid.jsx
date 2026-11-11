function Metric({ label, value, unit, sub, tone = 'text-white', children }) {
  return (
    <div className="flex flex-col gap-2 bg-ink p-4">
      <span className="label">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-4xl font-bold leading-none tracking-tight ${tone}`}>{value}</span>
        {unit && <span className="text-xs font-semibold uppercase tracking-widest text-muted">{unit}</span>}
      </div>
      {children}
      {sub && <span className="text-[11px] text-muted">{sub}</span>}
    </div>
  );
}

const scoreTone = (s) => (s >= 70 ? 'text-white' : s >= 40 ? 'text-warn' : 'text-alert');
const scoreBar = (s) => (s >= 70 ? 'bg-white' : s >= 40 ? 'bg-warn' : 'bg-alert');

export function MetricsGrid({ stats, lock }) {
  const { streak, completionRate30, totals, score, maxScore, strikes } = stats;
  const pct = Math.round((score / maxScore) * 100);

  return (
    <section aria-label="Discipline metrics" className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
      <Metric label="Active streak" value={streak.current} unit={streak.current === 1 ? 'day' : 'days'} sub={`Best ${streak.best}`} />
      <Metric
        label="Completion · 30d"
        value={completionRate30 === null ? '—' : completionRate30.toFixed(completionRate30 % 1 ? 1 : 0)}
        unit={completionRate30 === null ? null : '%'}
        tone={completionRate30 === null ? 'text-muted' : completionRate30 >= 80 ? 'text-white' : completionRate30 >= 50 ? 'text-warn' : 'text-alert'}
        sub={`${totals.done} done · ${totals.failed} failed`}
      />
      <Metric label="Discipline score" value={score} unit={`/${maxScore}`} tone={scoreTone(score)}>
        <div className="h-1 w-full bg-line-strong" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={maxScore} aria-label="Discipline score">
          <div className={`h-full ${scoreBar(score)} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </Metric>
      <Metric
        label="Penalty strikes"
        value={strikes}
        tone={strikes > 0 ? 'text-alert' : 'text-white'}
        sub={`${lock.strikesInCycle}/${lock.threshold} until lockout`}
      >
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: lock.threshold }, (_, i) => (
            <span key={i} className={`h-1 flex-1 ${i < lock.strikesInCycle ? 'bg-alert' : 'bg-line-strong'}`} />
          ))}
        </div>
      </Metric>
    </section>
  );
}
