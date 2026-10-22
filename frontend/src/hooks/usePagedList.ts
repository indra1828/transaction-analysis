import { useEffect, useRef, useState } from "react";

import { messageOf } from "./useAsync";

export const PAGE_SIZE = 10;

export interface PagedList<T> {
  items: T[] | null; // null until the first page arrives
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => void; // starts again from the first page
}

interface Settled<T> {
  key: string;
  items: T[];
  hasMore: boolean;
  error: string | null;
}

// Loads a list one page at a time. A new `key` starts again from the first page, and
// a slow response for an old key is ignored.
export function usePagedList<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  key: string,
  pageSize = PAGE_SIZE,
): PagedList<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);
  const latestFetch = useRef(fetchPage);
  const requestId = useRef(0);

  useEffect(() => {
    latestFetch.current = fetchPage;
  });

  useEffect(() => {
    const id = ++requestId.current;

    latestFetch.current(0, pageSize).then(
      (page) => {
        if (id === requestId.current) {
          setSettled({ key, items: page, hasMore: page.length === pageSize, error: null });
        }
      },
      (err: unknown) => {
        if (id === requestId.current) {
          setSettled({ key, items: [], hasMore: false, error: messageOf(err) });
        }
      },
    );
  }, [key, pageSize, version]);

  const current = settled?.key === key ? settled : null;

  const loadMore = async () => {
    if (!current || loadingMore) return;

    setLoadingMore(true);

    try {
      const page = await latestFetch.current(current.items.length, pageSize);
      setSettled((prev) =>
        prev && prev.key === key
          ? { ...prev, items: [...prev.items, ...page], hasMore: page.length === pageSize }
          : prev,
      );
    } catch (err) {
      setSettled((prev) => (prev && prev.key === key ? { ...prev, error: messageOf(err) } : prev));
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    items: current?.items ?? null,
    error: current?.error ?? null,
    hasMore: current?.hasMore ?? false,
    loadingMore,
    loadMore,
    reload: () => setVersion((value) => value + 1),
  };
}
