import { useCallback, useEffect, useRef } from "react";

/**
 * One in-flight request per component: begin() aborts any previous request and returns a
 * fresh signal; pending requests are aborted on unmount.
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const begin = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);

  const abort = useCallback(() => controllerRef.current?.abort(), []);

  return { begin, abort };
}
