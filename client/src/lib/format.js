export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const PRESETS = { everyday: 0b1111111, weekdays: 0b0111110, weekends: 0b1000001 };

export function describeDays(mask) {
  if (mask === PRESETS.everyday) return 'Daily';
  if (mask === PRESETS.weekdays) return 'Weekdays';
  if (mask === PRESETS.weekends) return 'Weekends';
  return DAY_NAMES.filter((_, i) => mask & (1 << i)).join(' · ');
}

/** "07:00" → "7:00 AM" in the viewer's locale. */
export function formatClock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatInstant(ms, timeZone, opts = { hour: 'numeric', minute: '2-digit' }) {
  try {
    return new Date(ms).toLocaleTimeString([], { ...opts, timeZone });
  } catch {
    return new Date(ms).toLocaleTimeString([], opts);
  }
}

export function formatDateTime(ms) {
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Countdown like "2h 05m", "04:59" (under an hour), or "00:00". */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const pad2 = (n) => String(n).padStart(2, '0');
