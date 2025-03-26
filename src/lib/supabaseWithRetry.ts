import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logError } from './errorLogger';

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  timeout: 15000
};

type SupabaseMethod = 'select' | 'insert' | 'update' | 'delete' | 'rpc';

function isRetryableError(error: Error | PostgrestError): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('fetch failed') ||
    message.includes('too many requests')
  );
}

async function withRetry<T>(
  operation: () => Promise<T>,
  method: SupabaseMethod,
  options: RetryOptions = DEFAULT_OPTIONS
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000 } = options;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    try {
      // Add timeout to the operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${method} operation timed out`));
        }, options.timeout);
      });

      // Race between operation and timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log the retry attempt
      console.debug(`Retry attempt ${attempt + 1}/${maxAttempts} for ${method}:`, error);

      // Only retry on network-related errors
      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      // Log the operation that will be retried
      await logError(lastError, {
        component: 'supabaseWithRetry',
        action: method,
        attempt: attempt + 1,
        delay,
        willRetry: attempt < maxAttempts - 1
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError;
}

export const supabaseWithRetry = {
  from: (table: string) => {
    const builder = supabase.from(table);
    
    return {
      ...builder,
      select: async (...args: Parameters<typeof builder.select>) => {
        return withRetry(
          () => builder.select(...args),
          'select'
        );
      },
      
      insert: async (...args: Parameters<typeof builder.insert>) => {
        return withRetry(
          () => builder.insert(...args),
          'insert'
        );
      },
      
      update: async (...args: Parameters<typeof builder.update>) => {
        return withRetry(
          () => builder.update(...args),
          'update'
        );
      },
      
      delete: async () => {
        return withRetry(
          () => builder.delete(),
          'delete'
        );
      },
      
      rpc: async (...args: Parameters<typeof builder.rpc>) => {
        return withRetry(
          () => builder.rpc(...args),
          'rpc'
        );
      }
    };
  },

  storage: {
    from: (bucket: string) => {
      const storage = supabase.storage.from(bucket);
      
      return {
        ...storage,
        upload: async (path: string, data: File | ArrayBuffer | ArrayBufferView | Blob | Buffer | string) => {
          return withRetry(
            () => storage.upload(path, data),
            'upload',
            { timeout: 30000 } // Longer timeout for uploads
          );
        },
        
        download: async (path: string) => {
          return withRetry(
            () => storage.download(path),
            'download'
          );
        },
        
        remove: async (paths: string[]) => {
          return withRetry(
            () => storage.remove(paths),
            'remove'
          );
        },
        
        list: async (path?: string) => {
          return withRetry(
            () => storage.list(path),
            'list'
          );
        }
      };
    }
  },

  auth: {
    ...supabase.auth,
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      return withRetry(
        () => supabase.auth.signInWithPassword(credentials),
        'signIn'
      );
    },
    
    signUp: async (credentials: { email: string; password: string }) => {
      return withRetry(
        () => supabase.auth.signUp(credentials),
        'signUp'
      );
    },
    
    refreshSession: async () => {
      return withRetry(
        () => supabase.auth.refreshSession(),
        'refreshSession'
      );
    }
  }
};