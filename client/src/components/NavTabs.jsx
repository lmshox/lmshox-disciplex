const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'log', label: 'Log' },
];

export function NavTabs({ active, onChange, badges = {} }) {
  return (
    <nav aria-label="Sections" className="mx-auto flex max-w-3xl border-b border-line px-4">
      {TABS.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] transition-colors ${
              selected ? 'border-white text-white' : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {t.label}
            {badges[t.id] ? (
              <span className="bg-alert px-1.5 font-mono text-[10px] leading-4 text-black">{badges[t.id]}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
