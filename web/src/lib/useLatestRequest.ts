import { useCallback, useEffect, useRef } from "react";

/**
 * One request at a time: starting one cancels the last, and leaving the page
 * cancels whatever is still running. Call it to start, and hand the signal on.
 */
export function useLatestRequest(): () => AbortSignal {
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  return useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    return controller.signal;
  }, []);
}
