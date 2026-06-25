import { useEffect, useState, useCallback } from "react";

// Module-level cache — persists across unmounts (tab switches).
const cache = new Map<string, any>();

export function useCachedData<T>(key: string, fetcher: () => Promise<T>, initial: T) {
  const hasCache = cache.has(key);
  const [data, setData] = useState<T>(() => (hasCache ? cache.get(key) : initial));
  // "first load" = we have nothing cached yet → show skeleton. Otherwise never.
  const [firstLoad, setFirstLoad] = useState(!hasCache);

  const refresh = useCallback(async () => {
    try {
      const result = await fetcher();
      cache.set(key, result);
      setData(result);
    } catch {
      /* keep stale cache on error */
    } finally {
      setFirstLoad(false);
    }
  }, [key, fetcher]);

  useEffect(() => {
    refresh(); // show cached instantly (if any), refresh quietly in background
  }, [refresh]);

  return { data, firstLoad, refresh, setData };
}

export function clearCache(key: string) {
  cache.delete(key);
}