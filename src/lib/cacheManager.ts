import { supabase } from './supabase';
import { handleError } from './errorHandler';

interface CacheOptions {
  ttl?: number;
  namespace?: string;
}

class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, any> = new Map();
  private expirations: Map<string, number> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private startCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Clean every minute
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, expiration] of this.expirations) {
      if (now >= expiration) {
        this.cache.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  private generateKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      const now = Date.now();

      // Check memory cache first
      if (this.cache.has(cacheKey)) {
        const expiration = this.expirations.get(cacheKey) || 0;
        if (now < expiration) {
          return this.cache.get(cacheKey);
        }
        // Remove expired item
        this.cache.delete(cacheKey);
        this.expirations.delete(cacheKey);
      }

      // Check database cache
      const { data, error } = await supabase
        .from('document_cache')
        .select('content')
        .eq('hash', cacheKey)
        .single();

      if (error) throw error;
      if (!data) return null;

      // Store in memory cache
      const ttl = options.ttl || this.defaultTTL;
      this.cache.set(cacheKey, data.content);
      this.expirations.set(cacheKey, now + ttl);

      return data.content;
    } catch (error) {
      await handleError(error, {
        component: 'CacheManager',
        action: 'get',
        key
      });
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      const ttl = options.ttl || this.defaultTTL;

      // Store in memory cache
      this.cache.set(cacheKey, value);
      this.expirations.set(cacheKey, Date.now() + ttl);

      // Store in database cache
      await supabase
        .from('document_cache')
        .upsert({
          hash: cacheKey,
          content: value,
          file_name: key,
          file_type: typeof value,
          file_size: JSON.stringify(value).length
        });
    } catch (error) {
      await handleError(error, {
        component: 'CacheManager',
        action: 'set',
        key
      });
    }
  }

  delete(key: string, namespace?: string): void {
    const cacheKey = this.generateKey(key, namespace);
    this.cache.delete(cacheKey);
    this.expirations.delete(cacheKey);
  }

  clear(namespace?: string): void {
    if (namespace) {
      const prefix = `${namespace}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          this.expirations.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.expirations.clear();
    }
  }
}

export const cacheManager = CacheManager.getInstance();