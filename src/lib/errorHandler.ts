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

// Fonction pour identifier le type d'erreur
function identifyErrorType(error: unknown): AppError {
  // Si c'est déjà une AppError, la retourner
  if (error instanceof AppError) {
    return error;
  }

  // Convertir en Error si ce n'est pas déjà le cas
  const originalError = error instanceof Error ? error : new Error(String(error));

  // Identifier le type d'erreur
  if (originalError.message.includes('taille')) {
    return new AppError({
      type: FileErrorType.SIZE_EXCEEDED,
      originalError
    });
  }

  if (originalError.message.includes('type')) {
    return new AppError({
      type: FileErrorType.INVALID_TYPE,
      originalError
    });
  }

  if (originalError.message.includes('JWT') || originalError.message.includes('token')) {
    return new AppError({
      type: AuthErrorType.TOKEN_EXPIRED,
      originalError
    });
  }

  if (originalError.message.includes('permission')) {
    return new AppError({
      type: DatabaseErrorType.PERMISSION_DENIED,
      originalError
    });
  }

  if (originalError.message.includes('network') || originalError.message.includes('fetch')) {
    return new AppError({
      type: NetworkErrorType.REQUEST_FAILED,
      originalError
    });
  }

  if (originalError.message.includes('required')) {
    return new AppError({
      type: ValidationErrorType.REQUIRED_FIELD,
      originalError
    });
  }

  // Erreur par défaut
  return new AppError({
    type: FileErrorType.PROCESSING_FAILED,
    originalError
  });
}

// Gestionnaire d'erreur principal
export async function handleError(
  error: unknown,
  context?: ErrorContext
): Promise<AppError> {
  const appError = identifyErrorType(error);

  // Ajouter le contexte
  if (context) {
    appError.context = {
      ...appError.context,
      ...context
    };
  }

  // Logger l'erreur
  await logError(appError);

  return appError;
}

// Décorateur pour les fonctions asynchrones
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw await handleError(error, context);
    }
  }) as T;
}

// Gestionnaire d'erreur pour les stores
export async function handleStoreError(
  error: unknown,
  storeName: string,
  action: string
): Promise<string> {
  const appError = await handleError(error, { store: storeName, action });
  return appError.getUserMessage();
}