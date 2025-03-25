import { AppErrorDetails, ERROR_MESSAGES } from './errorTypes';

export class AppError extends Error {
  readonly type: AppErrorDetails['type'];
  readonly code?: string;
  readonly context?: Record<string, any>;
  readonly originalError?: Error;

  constructor(details: AppErrorDetails) {
    const message = ERROR_MESSAGES[details.type] || 'Une erreur est survenue';
    super(message);

    this.name = 'AppError';
    this.type = details.type;
    this.code = details.code;
    this.context = details.context;
    this.originalError = details.originalError;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    // Add original error stack if available
    if (this.originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${this.originalError.stack}`;
    }
  }

  // Méthodes utilitaires
  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      context: this.context,
      stack: this.stack
    };
  }

  public getDetails() {
    return {
      type: this.type,
      code: this.code,
      context: this.context
    };
  }

  public getUserMessage(): string {
    return ERROR_MESSAGES[this.type] || this.message;
  }

  public isOperational(): boolean {
    // Les erreurs opérationnelles sont celles qui peuvent être gérées
    return [
      'INVALID_TYPE',
      'SIZE_EXCEEDED',
      'REQUIRED_FIELD',
      'INVALID_FORMAT',
      'UNIQUE_CONSTRAINT'
    ].includes(this.type);
  }
}