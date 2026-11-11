import { useCallback, useEffect, useRef, useState } from 'react';
import { api, auth } from '../lib/api.js';
import { outbox } from '../lib/outbox.js';
import { KEYS, read, write } from '../lib/storage.js';

const REFRESH_MS = 30_000;

/**
 * Central app state. The server snapshot is the source of truth; it is cached
 * locally so the app opens (read-only, marked stale) without a connection.
 */
export function useDiscipline() {
  const [token, setToken] = useState(auth.token);
  const [snapshot, setSnapshot] = useState(() => (auth.token ? read(KEYS.snapshot) : null));
  const [stale, setStale] = useState(true);
  const [clockOffset, setClockOffset] = useState(0);
  const [queued, setQueued] = useState(() => outbox.list().map((i) => i.instanceId));
  const [notice, setNotice] = useState(null);
  const inflight = useRef(null);

  const notify = useCallback((kind, message) => setNotice({ kind, message, id: Date.now() }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const apply = useCallback((snap) => {
    if (!snap) return;
    setSnapshot(snap);
    setStale(false);
    setClockOffset(snap.serverTime - Date.now());
    write(KEYS.snapshot, snap);
  }, []);

  const signOutLocal = useCallback(() => {
    auth.set(null);
    write(KEYS.snapshot, null);
    outbox.clear();
    setQueued([]);
    setSnapshot(null);
    setToken(null);
  }, []);

  useEffect(() => auth.onUnauthorized(signOutLocal), [signOutLocal]);

  /** Flushes queued completions, then pulls a fresh snapshot. De-duplicated while in flight. */
  const refresh = useCallback(() => {
    if (!auth.token) return Promise.resolve();
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        if (outbox.list().length) {
          const { rejected, offline } = await outbox.flush();
          setQueued(outbox.list().map((i) => i.instanceId));
          if (offline) return setStale(true);
          for (const r of rejected) notify('alert', `Queued completion rejected: ${r.reason}`);
        }
        apply(await api.state());
      } catch (err) {
        if (err.isNetwork) setStale(true);
        else if (err.status !== 401) notify('alert', err.message);
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [apply, notify]);

  // Initial load, polling, focus and reconnect refresh.
  useEffect(() => {
    if (!token) return;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [token, refresh]);

  // Re-sync the moment the next deadline or lockout expires, so FAILED shows instantly.
  useEffect(() => {
    if (!snapshot) return;
    const now = Date.now() + clockOffset;
    const upcoming = [
      ...snapshot.today.filter((t) => t.status === 'pending').map((t) => t.deadlineAt),
      snapshot.lock.locked ? snapshot.lock.lockedUntil : null,
    ].filter((t) => t && t > now);
    if (!upcoming.length) return;
    const delay = Math.min(...upcoming) - now + 750;
    if (delay > 2 ** 31 - 1) return;
    const id = setTimeout(refresh, delay);
    return () => clearTimeout(id);
  }, [snapshot, clockOffset, refresh]);

  // ---- Auth ----------------------------------------------------------------
  const authenticate = useCallback(
    async (mode, username, password) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const { token: t } =
        mode === 'register' ? await api.register(username, password, timezone) : await api.login(username, password);
      auth.set(t);
      setToken(t);
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    signOutLocal();
  }, [signOutLocal]);

  // ---- Commands --------------------------------------------------------------
  const complete = useCallback(
    async (instanceId) => {
      try {
        apply(await api.complete(instanceId));
      } catch (err) {
        if (err.isNetwork) {
          outbox.add(instanceId);
          setQueued(outbox.list().map((i) => i.instanceId));
          setStale(true);
          notify('warn', 'Offline: completion queued. The server clock decides when it syncs.');
          return;
        }
        notify('alert', err.message);
        refresh();
      }
    },
    [apply, notify, refresh],
  );

  /** Wraps a mutation that returns a snapshot; errors propagate so forms can display them. */
  const mutate = useCallback(
    (fn) =>
      async (...args) => {
        try {
          const snap = await fn(...args);
          apply(snap);
          return snap;
        } catch (err) {
          if (err.status === 423) refresh();
          throw err;
        }
      },
    [apply, refresh],
  );

  return {
    token,
    snapshot,
    stale,
    clockOffset,
    queued,
    notice,
    dismissNotice,
    notify,
    refresh,
    authenticate,
    logout,
    complete,
    createTask: mutate(api.createTask),
    updateTask: mutate(api.updateTask),
    archiveTask: mutate(api.archiveTask),
    submitAccountability: mutate(api.accountability),
  };
}
