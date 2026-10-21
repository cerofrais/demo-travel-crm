"use client";

import { useEffect, useState } from "react";
import { getDb, subscribe } from "./store";
import type { DemoData } from "./types";

/**
 * Subscribes a component to the demo store. Returns the live DemoData and
 * re-renders on every mutation. The first client render after hydration also
 * triggers a re-render so the persisted copy replaces the SSR throwaway seed.
 */
export function useDb(): DemoData {
  const [, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getDb();
}

/** True once the component has mounted on the client (store is authoritative). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
