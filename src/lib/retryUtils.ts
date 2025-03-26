import { handleError } from './errorHandler';
import { NetworkErrorType } from './errorTypes';

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

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: {
    component: string;
    action: string;
    [key: string]: any;
  },
  options: RetryOptions = DEFAULT_OPTIONS
): Promise<T> {
  let attempt = 0;
  const maxAttempts = options.maxAttempts || DEFAULT_OPTIONS.maxAttempts!;
  const initialDelay = options.initialDelay || DEFAULT_OPTIONS.initialDelay!;
  const maxDelay = options.maxDelay || DEFAULT_OPTIONS.maxDelay!;
  const timeout = options.timeout || DEFAULT_OPTIONS.timeout!;

  while (attempt < maxAttempts) {
    try {
      // Check network status
      if (!navigator.onLine) {
        throw new Error('No internet connection');
      }

      // Check connection quality if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
          throw new Error('Poor network connection');
        }
      }

      // Add timeout to operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Operation timed out'));
        }, timeout);
      });

      // Execute operation with timeout
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      attempt++;

      // Log retry attempt
      console.debug(
        `Retry attempt ${attempt}/${maxAttempts}:`,
        error instanceof Error ? error.message : error
      );

      // Check if we should retry
      const shouldRetry = 
        attempt < maxAttempts && 
        (error instanceof Error) &&
        (
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('connection') ||
          !navigator.onLine
        );

      if (!shouldRetry) {
        throw await handleError(error, {
          ...context,
          type: NetworkErrorType.REQUEST_FAILED,
          attempt,
          maxAttempts,
          networkStatus: {
            online: navigator.onLine,
            connectionType: ('connection' in navigator)
              ? (navigator as any).connection?.effectiveType
              : 'unknown'
          }
        });
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt - 1),
        maxDelay
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw await handleError(new Error('Max retry attempts reached'), {
    ...context,
    type: NetworkErrorType.REQUEST_FAILED,
    attempt,
    maxAttempts,
    networkStatus: {
      online: navigator.onLine,
      connectionType: ('connection' in navigator)
        ? (navigator as any).connection?.effectiveType
        : 'unknown'
    }
  });
}