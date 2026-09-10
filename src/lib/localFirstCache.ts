/* ═══════════════════════════════════════════════════════════════
   LOCAL-FIRST CACHE — Instant Hydration Layer
   
   Stores the last-known state of critical bio-data in IndexedDB
   (with localStorage fallback). When the app reopens, cached data
   renders instantly while Convex syncs fresh data in the background.
   
   Cache keys are namespaced per sessionId to support multi-user.
   TTL is 24 hours — stale data shows a subtle "syncing" indicator.
   ═══════════════════════════════════════════════════════════════ */

const DB_NAME = 'vive-bio-cache';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CacheEntry<T> = {
  key: string;
  data: T;
  timestamp: number;
  sessionId: string;
};

/* ── IndexedDB Helpers ── */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(entry: CacheEntry<T>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silent fail
  }
}

/* ── localStorage Fallback ── */

function lsKey(key: string): string {
  return `vive-cache:${key}`;
}

function lsGet<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function lsSet<T>(entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(lsKey(entry.key), JSON.stringify(entry));
  } catch {
    // quota exceeded — silent
  }
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════ */

export interface CachedResult<T> {
  data: T | null;
  isStale: boolean;
  cachedAt: number | null;
}

/**
 * Read cached data for a given key + sessionId.
 * Returns null if no cache exists or if expired beyond TTL.
 */
export async function readCache<T>(
  key: string,
  sessionId: string
): Promise<CachedResult<T>> {
  const cacheKey = `${sessionId}:${key}`;

  // Try IndexedDB first
  let entry = await idbGet<T>(cacheKey);

  // Fallback to localStorage
  if (!entry) {
    entry = lsGet<T>(cacheKey);
  }

  if (!entry) {
    return { data: null, isStale: false, cachedAt: null };
  }

  const age = Date.now() - entry.timestamp;
  const isStale = age > TTL_MS;

  // Don't return data older than 7 days
  if (age > TTL_MS * 7) {
    return { data: null, isStale: true, cachedAt: null };
  }

  return {
    data: entry.data,
    isStale,
    cachedAt: entry.timestamp,
  };
}

/**
 * Write data to cache (both IndexedDB and localStorage fallback).
 */
export async function writeCache<T>(
  key: string,
  sessionId: string,
  data: T
): Promise<void> {
  const entry: CacheEntry<T> = {
    key: `${sessionId}:${key}`,
    data,
    timestamp: Date.now(),
    sessionId,
  };

  // Write to both stores for redundancy
  await idbSet(entry);
  lsSet(entry);
}

/**
 * Synchronous read from localStorage only (for initial render).
 * Use this in useMemo/useState initializers where async isn't possible.
 */
export function readCacheSync<T>(
  key: string,
  sessionId: string
): CachedResult<T> {
  const cacheKey = `${sessionId}:${key}`;
  const entry = lsGet<T>(cacheKey);

  if (!entry) {
    return { data: null, isStale: false, cachedAt: null };
  }

  const age = Date.now() - entry.timestamp;
  if (age > TTL_MS * 7) {
    return { data: null, isStale: true, cachedAt: null };
  }

  return {
    data: entry.data,
    isStale: age > TTL_MS,
    cachedAt: entry.timestamp,
  };
}

/* ── Cache Keys (centralized) ── */
export const CACHE_KEYS = {
  BIO_CONTEXT: 'bio-context',
  SOMATIC_MAP: 'somatic-map',
  LONGEVITY_SCORE: 'longevity-score',
  BIOLOGICAL_TWIN: 'biological-twin',
  RECOVERY_INDEX: 'recovery-index',
  BIO_FORECAST: 'bio-forecast',
  DAILY_PROTOCOL: 'daily-protocol',
  BIO_DASHBOARD: 'bio-dashboard',
  ELITE_SCORE: 'elite-score',
} as const;
