// Types d'erreurs spécifiques par domaine
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
  TOKEN_EXPIRED = 'TOKEN_EXPIRED'
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
  RATE_LIMIT = 'RATE_LIMIT'
}

export enum ValidationErrorType {
  REQUIRED_FIELD = 'REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  UNIQUE_CONSTRAINT = 'UNIQUE_CONSTRAINT',
  INVALID_REFERENCE = 'INVALID_REFERENCE'
}

// Interface pour les erreurs personnalisées
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

// Messages d'erreur par type
export const ERROR_MESSAGES: Record<string, string> = {
  // Erreurs de fichier
  [FileErrorType.INVALID_TYPE]: "Type de fichier non supporté",
  [FileErrorType.SIZE_EXCEEDED]: "Taille de fichier dépassée",
  [FileErrorType.PROCESSING_FAILED]: "Échec du traitement du fichier",
  [FileErrorType.UPLOAD_FAILED]: "Échec de l'envoi du fichier",
  [FileErrorType.DOWNLOAD_FAILED]: "Échec du téléchargement du fichier",
  [FileErrorType.CORRUPT_FILE]: "Fichier corrompu",
  [FileErrorType.UNSUPPORTED_ENCODING]: "Encodage non supporté",

  // Erreurs de document
  [DocumentErrorType.EXTRACTION_FAILED]: "Échec de l'extraction du contenu",
  [DocumentErrorType.OCR_FAILED]: "Échec de la reconnaissance de texte",
  [DocumentErrorType.PARSING_FAILED]: "Échec de l'analyse du document",
  [DocumentErrorType.INVALID_CONTENT]: "Contenu du document invalide",
  [DocumentErrorType.MISSING_CONTENT]: "Contenu du document manquant",

  // Erreurs d'authentification
  [AuthErrorType.INVALID_CREDENTIALS]: "Identifiants invalides",
  [AuthErrorType.SESSION_EXPIRED]: "Session expirée",
  [AuthErrorType.UNAUTHORIZED]: "Accès non autorisé",
  [AuthErrorType.ACCOUNT_DISABLED]: "Compte désactivé",
  [AuthErrorType.TOKEN_EXPIRED]: "Token expiré",

  // Erreurs de base de données
  [DatabaseErrorType.CONNECTION_FAILED]: "Erreur de connexion à la base de données",
  [DatabaseErrorType.QUERY_FAILED]: "Erreur lors de la requête",
  [DatabaseErrorType.CONSTRAINT_VIOLATION]: "Violation de contrainte",
  [DatabaseErrorType.TRANSACTION_FAILED]: "Échec de la transaction",
  [DatabaseErrorType.PERMISSION_DENIED]: "Permission refusée",

  // Erreurs réseau
  [NetworkErrorType.REQUEST_FAILED]: "Échec de la requête",
  [NetworkErrorType.TIMEOUT]: "Délai d'attente dépassé",
  [NetworkErrorType.CORS_ERROR]: "Erreur CORS",
  [NetworkErrorType.API_ERROR]: "Erreur API",
  [NetworkErrorType.RATE_LIMIT]: "Limite de requêtes atteinte",

  // Erreurs de validation
  [ValidationErrorType.REQUIRED_FIELD]: "Champ requis manquant",
  [ValidationErrorType.INVALID_FORMAT]: "Format invalide",
  [ValidationErrorType.OUT_OF_RANGE]: "Valeur hors limites",
  [ValidationErrorType.UNIQUE_CONSTRAINT]: "Valeur déjà utilisée",
  [ValidationErrorType.INVALID_REFERENCE]: "Référence invalide"
};