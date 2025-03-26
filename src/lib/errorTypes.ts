// Error types by domain
export enum FileErrorType {
  INVALID_TYPE = 'INVALID_TYPE',
  SIZE_EXCEEDED = 'SIZE_EXCEEDED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  CORRUPT_FILE = 'CORRUPT_FILE',
  UNSUPPORTED_ENCODING = 'UNSUPPORTED_ENCODING'
}

export enum DocumentErrorType {
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  OCR_FAILED = 'OCR_FAILED',
  PARSING_FAILED = 'PARSING_FAILED',
  INVALID_CONTENT = 'INVALID_CONTENT',
  MISSING_CONTENT = 'MISSING_CONTENT'
}

export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

export enum NetworkErrorType {
  REQUEST_FAILED = 'REQUEST_FAILED',
  TIMEOUT = 'TIMEOUT',
  CORS_ERROR = 'CORS_ERROR',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  OFFLINE = 'OFFLINE',
  POOR_CONNECTION = 'POOR_CONNECTION'
}

export enum ValidationErrorType {
  REQUIRED_FIELD = 'REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  UNIQUE_CONSTRAINT = 'UNIQUE_CONSTRAINT',
  INVALID_REFERENCE = 'INVALID_REFERENCE'
}

// Interface for custom errors
export interface AppErrorDetails {
  type: 
    | FileErrorType 
    | DocumentErrorType 
    | AuthErrorType 
    | DatabaseErrorType 
    | NetworkErrorType 
    | ValidationErrorType;
  code?: string;
  context?: Record<string, any>;
  originalError?: Error;
}

// Error messages
export const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  [AuthErrorType.INVALID_CREDENTIALS]: "Identifiants invalides",
  [AuthErrorType.SESSION_EXPIRED]: "Session expirée, veuillez vous reconnecter",
  [AuthErrorType.UNAUTHORIZED]: "Accès non autorisé",
  [AuthErrorType.ACCOUNT_DISABLED]: "Compte désactivé",
  [AuthErrorType.TOKEN_EXPIRED]: "Session expirée",
  [AuthErrorType.INITIALIZATION_FAILED]: "Erreur d'initialisation de l'authentification",
  [AuthErrorType.NETWORK_ERROR]: "Erreur réseau lors de l'authentification",

  // Network errors
  [NetworkErrorType.REQUEST_FAILED]: "La requête a échoué",
  [NetworkErrorType.TIMEOUT]: "Délai d'attente dépassé",
  [NetworkErrorType.CORS_ERROR]: "Erreur de sécurité CORS",
  [NetworkErrorType.API_ERROR]: "Erreur API",
  [NetworkErrorType.RATE_LIMIT]: "Trop de requêtes",
  [NetworkErrorType.OFFLINE]: "Pas de connexion internet",
  [NetworkErrorType.POOR_CONNECTION]: "Connexion internet instable",

  // Database errors
  [DatabaseErrorType.CONNECTION_FAILED]: "Erreur de connexion à la base de données",
  [DatabaseErrorType.QUERY_FAILED]: "Erreur de requête",
  [DatabaseErrorType.CONSTRAINT_VIOLATION]: "Violation de contrainte",
  [DatabaseErrorType.TRANSACTION_FAILED]: "Transaction échouée",
  [DatabaseErrorType.PERMISSION_DENIED]: "Permission refusée",

  // Validation errors
  [ValidationErrorType.REQUIRED_FIELD]: "Champ requis manquant",
  [ValidationErrorType.INVALID_FORMAT]: "Format invalide",
  [ValidationErrorType.OUT_OF_RANGE]: "Valeur hors limites",
  [ValidationErrorType.UNIQUE_CONSTRAINT]: "Valeur déjà utilisée",
  [ValidationErrorType.INVALID_REFERENCE]: "Référence invalide",

  // Default error
  'DEFAULT': "Une erreur est survenue"
};