"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readDemoState, subscribeDemoState, updateDemoState } from "@/lib/demo-store";

export function useDemoState<T>(key: string, fallback: T) {
  const subscribe = useCallback((listener: () => void) => subscribeDemoState(key, listener), [key]);
  const getSnapshot = useCallback(() => readDemoState(key, fallback), [fallback, key]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    updateDemoState(key, fallback, next);
  }, [fallback, key]);

  return [value, setValue] as const;
}
