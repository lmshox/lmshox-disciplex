import { useCallback, useEffect, useState } from 'react';

/** Registers /sw.js in production and surfaces "update available" when a new build is waiting. */
export function useServiceWorker() {
  const [waiting, setWaiting] = useState(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let registration;
    let reloading = false;

    const track = (worker) => {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
      });
    };
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => track(reg.installing));
      })
      .catch((err) => console.warn('Service worker registration failed', err));

    const check = () => document.visibilityState === 'visible' && registration?.update().catch(() => {});
    document.addEventListener('visibilitychange', check);
    const id = setInterval(check, 60 * 60_000);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
    };
  }, []);

  const applyUpdate = useCallback(() => waiting?.postMessage({ type: 'SKIP_WAITING' }), [waiting]);
  return { updateAvailable: Boolean(waiting), applyUpdate };
}
