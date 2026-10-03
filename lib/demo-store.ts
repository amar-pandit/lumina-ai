import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, normalizeDemoState } from "@/lib/demo-model";

interface CachedValue {
  raw: string | null;
  value: unknown;
}

type Subscriber = () => void;

const cache = new Map<string, CachedValue>();
const subscribers = new Map<string, Set<Subscriber>>();
const fallbackRaw = "__lumina-demo-fallback__";

function notify(key: string) {
  subscribers.get(key)?.forEach((subscriber) => subscriber());
}

function onStorage(event: StorageEvent) {
  if (event.key === null) {
    cache.clear();
    subscribers.forEach((listeners) => listeners.forEach((listener) => listener()));
    return;
  }
  cache.delete(event.key);
  notify(event.key);
}

export function readDemoState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    const memoryValue = cache.get(key);
    return memoryValue?.value as T | undefined ?? fallback;
  }

  const normalizedRaw = raw ?? fallbackRaw;
  const cached = cache.get(key);
  if (cached?.raw === normalizedRaw) return cached.value as T;

  if (raw === null) {
    cache.set(key, { raw: normalizedRaw, value: fallback });
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const value: unknown = key === DEMO_STATE_KEY ? normalizeDemoState(parsed ?? INITIAL_DEMO_STATE) : parsed;
    let cachedRaw = raw;
    if (key === DEMO_STATE_KEY) {
      const normalizedRaw = JSON.stringify(value);
      if (normalizedRaw !== raw) {
        try {
          window.localStorage.setItem(key, normalizedRaw);
          cachedRaw = normalizedRaw;
        } catch {
          cachedRaw = raw;
        }
      }
    }
    cache.set(key, { raw: cachedRaw, value });
    return value as T;
  } catch {
    cache.set(key, { raw, value: fallback });
    return fallback;
  }
}

export function writeDemoState<T>(key: string, value: T) {
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, serialized);
    cache.set(key, { raw: serialized, value });
  } catch {
    cache.set(key, { raw: serialized, value });
  }
  notify(key);
}

export function updateDemoState<T>(key: string, fallback: T, update: T | ((current: T) => T)): T {
  const current = readDemoState(key, fallback);
  const next = typeof update === "function"
    ? (update as (previous: T) => T)(current)
    : update;
  writeDemoState(key, next);
  return next;
}

export function subscribeDemoState(key: string, subscriber: Subscriber) {
  const listeners = subscribers.get(key) ?? new Set<Subscriber>();
  listeners.add(subscriber);
  subscribers.set(key, listeners);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(subscriber);
    if (listeners.size === 0) subscribers.delete(key);
    if (subscribers.size === 0) window.removeEventListener("storage", onStorage);
  };
}
