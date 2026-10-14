import { useCallback, useEffect, useRef, useState } from "react";

interface Settled<T> {
  key: string;
  data: T | undefined;
  error: string | null;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  // Refreshes the data. Resolves once the new result is in state. If the
  // refresh fails, the last good data is kept and the error is shown.
  reload: () => Promise<void>;
}

// Loads data for `key` and reloads it on demand. Results for an earlier key
// are never shown, and a slow response cannot overwrite a newer one.
export function useAsync<T>(
  load: () => Promise<T>,
  key: string,
  errorMessage: (error: unknown) => string = messageOf,
): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const latest = useRef({ load, key, errorMessage });
  const requestId = useRef(0);

  useEffect(() => {
    latest.current = { load, key, errorMessage };
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const current = latest.current;

    try {
      const data = await current.load();

      if (id === requestId.current) {
        setSettled({ key: current.key, data, error: null });
      }
    } catch (err) {
      if (id === requestId.current) {
        const message = current.errorMessage(err);
        setSettled((prev) => ({
          key: current.key,
          data: prev?.key === current.key ? prev.data : undefined,
          error: message,
        }));
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [key, reload]);

  const current = settled?.key === key ? settled : null;

  return {
    data: current?.data,
    error: current?.error ?? null,
    loading: current === null,
    reload,
  };
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
