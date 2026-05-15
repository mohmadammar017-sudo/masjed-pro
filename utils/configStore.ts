const rawCache = new Map<string, string | null>();
const pendingWrites = new Map<string, string | null>();

let flushScheduled = false;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const hasWindow = typeof window !== 'undefined';

const flushPendingWrites = () => {
  flushScheduled = false;
  if (timeoutId !== null && hasWindow) {
    window.clearTimeout(timeoutId);
    timeoutId = null;
  }

  if (!hasWindow || pendingWrites.size === 0) return;

  for (const [key, value] of pendingWrites.entries()) {
    try {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`[configStore] Failed to persist key "${key}"`, error);
    }
  }

  pendingWrites.clear();
};

const scheduleFlush = () => {
  if (!hasWindow || flushScheduled) return;
  flushScheduled = true;

  const runFlush = () => flushPendingWrites();

  if ('requestIdleCallback' in window) {
    (window as Window & {
      requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    }).requestIdleCallback(runFlush, { timeout: 240 });
    return;
  }

  timeoutId = globalThis.setTimeout(runFlush, 80);
};

const readRawValue = (key: string): string | null => {
  if (rawCache.has(key)) return rawCache.get(key) ?? null;
  if (!hasWindow) return null;

  try {
    const stored = window.localStorage.getItem(key);
    rawCache.set(key, stored);
    return stored;
  } catch (error) {
    console.error(`[configStore] Failed to read key "${key}"`, error);
    return null;
  }
};

const queueRawValue = (key: string, value: string | null) => {
  rawCache.set(key, value);
  pendingWrites.set(key, value);
  scheduleFlush();
};

export const flushConfigStore = () => {
  flushPendingWrites();
};

export const getStoredJson = <T>(key: string, fallback: T, transform?: (value: unknown) => T): T => {
  const raw = readRawValue(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    const value = transform ? transform(parsed) : (parsed as T);
    return value ?? fallback;
  } catch (error) {
    console.error(`[configStore] Failed to parse key "${key}"`, error);
    return fallback;
  }
};

export const setStoredJson = (key: string, value: unknown) => {
  try {
    queueRawValue(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[configStore] Failed to serialize key "${key}"`, error);
  }
};

export const getStoredString = (key: string, fallback: string | null = null): string | null => {
  const raw = readRawValue(key);
  return raw ?? fallback;
};

export const setStoredString = (key: string, value: string | null) => {
  queueRawValue(key, value);
};

export const getStoredNumber = (key: string, fallback = 0): number => {
  const raw = readRawValue(key);
  if (raw === null) return fallback;

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const setStoredNumber = (key: string, value: number) => {
  queueRawValue(key, String(value));
};

export const removeStoredValue = (key: string) => {
  queueRawValue(key, null);
};
