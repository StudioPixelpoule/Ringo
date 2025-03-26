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
      type: NetworkErrorType.OFFLINE,
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
  if (originalError.message.includes('Invalid API key') ||
      originalError.message.includes('Invalid login credentials') ||
      originalError.message.includes('JWT') || 
      originalError.message.includes('token') ||
      originalError.message.includes('session') ||
      originalError.message.includes('auth') ||
      originalError.message.includes('Profile inactive')) {
    return new AppError({
      type: AuthErrorType.SESSION_EXPIRED,
      originalError,
      context: {
        timestamp: new Date().toISOString()
      }
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