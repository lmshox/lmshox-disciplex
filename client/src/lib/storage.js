/** localStorage wrappers that never throw (private mode, blocked storage, quota). */
export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: degrade silently */
  }
}

export const KEYS = {
  token: 'dx.token',
  snapshot: 'dx.snapshot',
  outbox: 'dx.outbox',
  installDismissed: 'dx.install.dismissedAt',
};
