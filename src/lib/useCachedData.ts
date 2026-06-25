import { useEffect, useState, useRef, useCallback } from "react";

const cache = new Map<string, any>();

export function useCachedData<T>(key: string, fetcher: () => Promise<T>, initial: T) {
  const hasCache = cache.has(key);
  const [data, setData] = useState<T>(() => (hasCache ? cache.get(key) : initial));
  const [firstLoad, setFirstLoad] = useState(!hasCache);

  // Keep the latest fetcher in a ref so it doesn't trigger the effect.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      cache.set(key, result);
      setData(result);
    } catch {
      /* keep stale cache */
    } finally {
      setFirstLoad(false);
    }
  }, [key]); // only depends on the stable key, NOT the fetcher

  // Run once per key (on mount / when key changes), not every render.
  useEffect(() => {
    refresh();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, firstLoad, refresh, setData };
}

export function clearCache(key: string) {
  cache.delete(key);
}