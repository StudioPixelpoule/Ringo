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
  // File errors
  [FileErrorType.INVALID_TYPE]: "File type not supported",
  [FileErrorType.SIZE_EXCEEDED]: "File size exceeded",
  [FileErrorType.PROCESSING_FAILED]: "File processing failed",
  [FileErrorType.UPLOAD_FAILED]: "File upload failed",
  [FileErrorType.DOWNLOAD_FAILED]: "File download failed",
  [FileErrorType.CORRUPT_FILE]: "Corrupted file",
  [FileErrorType.UNSUPPORTED_ENCODING]: "Unsupported encoding",

  // Document errors
  [DocumentErrorType.EXTRACTION_FAILED]: "Content extraction failed",
  [DocumentErrorType.OCR_FAILED]: "Text recognition failed",
  [DocumentErrorType.PARSING_FAILED]: "Document parsing failed",
  [DocumentErrorType.INVALID_CONTENT]: "Invalid document content",
  [DocumentErrorType.MISSING_CONTENT]: "Missing document content",

  // Authentication errors
  [AuthErrorType.INVALID_CREDENTIALS]: "Invalid credentials",
  [AuthErrorType.SESSION_EXPIRED]: "Session expired",
  [AuthErrorType.UNAUTHORIZED]: "Unauthorized access",
  [AuthErrorType.ACCOUNT_DISABLED]: "Account disabled",
  [AuthErrorType.TOKEN_EXPIRED]: "Token expired",

  // Database errors
  [DatabaseErrorType.CONNECTION_FAILED]: "Database connection error",
  [DatabaseErrorType.QUERY_FAILED]: "Query error",
  [DatabaseErrorType.CONSTRAINT_VIOLATION]: "Constraint violation",
  [DatabaseErrorType.TRANSACTION_FAILED]: "Transaction failed",
  [DatabaseErrorType.PERMISSION_DENIED]: "Permission denied",

  // Network errors
  [NetworkErrorType.REQUEST_FAILED]: "Request failed",
  [NetworkErrorType.TIMEOUT]: "Request timeout",
  [NetworkErrorType.CORS_ERROR]: "CORS error",
  [NetworkErrorType.API_ERROR]: "API error",
  [NetworkErrorType.RATE_LIMIT]: "Rate limit reached",

  // Validation errors
  [ValidationErrorType.REQUIRED_FIELD]: "Required field missing",
  [ValidationErrorType.INVALID_FORMAT]: "Invalid format",
  [ValidationErrorType.OUT_OF_RANGE]: "Value out of range",
  [ValidationErrorType.UNIQUE_CONSTRAINT]: "Value already in use",
  [ValidationErrorType.INVALID_REFERENCE]: "Invalid reference"
};