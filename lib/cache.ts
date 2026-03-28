// Simple in-memory cache for serverless functions
// Each cache entry has a TTL (time-to-live) in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// TTLs by source
export const CACHE_TTL = {
  GHL: 5 * 60 * 1000,        // 5 minutes
  HYROS: 15 * 60 * 1000,     // 15 minutes
  META: 15 * 60 * 1000,      // 15 minutes
  AGGREGATED: 5 * 60 * 1000, // 5 minutes
  SHEETS: 5 * 60 * 1000,     // 5 minutes — sheets updated multiple times daily
};
