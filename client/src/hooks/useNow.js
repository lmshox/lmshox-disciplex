import { useEffect, useState } from 'react';

/** Current time (ms), re-rendering every `interval` ms. `offset` corrects for client/server clock skew. */
export function useNow(interval = 1000, offset = 0) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now + offset;
}
