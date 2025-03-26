import { ErrorContext } from './types';
import { AppError } from './AppError';
import { logError } from './errorLogger';
import { 
  FileErrorType,
  DocumentErrorType,
  AuthErrorType,
  DatabaseErrorType,
  NetworkErrorType,
  ValidationErrorType
} from './errorTypes';

// Function to identify error type
function identifyErrorType(error: unknown): AppError {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Convert to Error if not already
  const originalError = error instanceof Error ? error : new Error(String(error));

  // Check for network/connection errors first
  if (!navigator.onLine || 
      originalError.message.includes('network') ||
      originalError.message.includes('fetch failed') ||
      originalError.message.includes('timeout')) {
    return new AppError({
      type: NetworkErrorType.REQUEST_FAILED,
      originalError,
      context: {
        isOnline: navigator.onLine,
        connectionType: ('connection' in navigator) 
          ? (navigator as any).connection?.effectiveType 
          : 'unknown'
      }
    });
  }

  // Check for auth errors
  if (originalError.message.includes('JWT') || 
      originalError.message.includes('token') ||
      originalError.message.includes('session') ||
      originalError.message.includes('auth')) {
    return new AppError({
      type: AuthErrorType.SESSION_EXPIRED,
      originalError
    });
  }

  // Check for permission errors
  if (originalError.message.includes('permission') ||
      originalError.message.includes('access denied')) {
    return new AppError({
      type: DatabaseErrorType.PERMISSION_DENIED,
      originalError
    });
  }

  // Check for validation errors
  if (originalError.message.includes('required') ||
      originalError.message.includes('invalid') ||
      originalError.message.includes('format')) {
    return new AppError({
      type: ValidationErrorType.INVALID_FORMAT,
      originalError
    });
  }

  // Default error
  return new AppError({
    type: NetworkErrorType.REQUEST_FAILED,
    originalError
  });
}

// Main error handler
export async function handleError(
  error: unknown,
  context?: ErrorContext
): Promise<AppError> {
  const appError = identifyErrorType(error);

  // Add context
  if (context) {
    appError.context = {
      ...appError.context,
      ...context,
      timestamp: new Date().toISOString(),
      isOnline: navigator.onLine,
      connectionType: ('connection' in navigator) 
        ? (navigator as any).connection?.effectiveType 
        : 'unknown'
    };
  }

  // Log error
  await logError(appError);

  return appError;
}

// Decorator for async functions
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw await handleError(error, {
        ...context,
        args: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        )
      });
    }
  }) as T;
}

// Store error handler
export async function handleStoreError(
  error: unknown,
  storeName: string,
  action: string
): Promise<string> {
  const appError = await handleError(error, { 
    store: storeName, 
    action,
    timestamp: new Date().toISOString()
  });
  return appError.getUserMessage();
}