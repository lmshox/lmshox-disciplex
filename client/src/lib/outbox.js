/**
 * Offline outbox for completions. Queued actions are replayed in order when
 * the connection returns. The server stamps completion with its own clock, so
 * a completion that arrives after the deadline is rejected — that is the rule.
 */
import { api } from './api.js';
import { KEYS, read, write } from './storage.js';

export const outbox = {
  list: () => read(KEYS.outbox, []),
  add(instanceId) {
    const items = outbox.list();
    if (!items.some((i) => i.instanceId === instanceId)) {
      items.push({ instanceId, queuedAt: Date.now() });
      write(KEYS.outbox, items);
    }
  },
  clear: () => write(KEYS.outbox, null),

  /** Replays queued completions. Returns { snapshot, rejected[] }; stops early if still offline. */
  async flush() {
    let snapshot = null;
    const rejected = [];
    for (const item of outbox.list()) {
      try {
        snapshot = await api.complete(item.instanceId);
      } catch (err) {
        if (err.isNetwork) return { snapshot, rejected, offline: true };
        rejected.push({ ...item, reason: err.message });
      }
      write(KEYS.outbox, outbox.list().filter((i) => i.instanceId !== item.instanceId));
    }
    return { snapshot, rejected, offline: false };
  },
};
