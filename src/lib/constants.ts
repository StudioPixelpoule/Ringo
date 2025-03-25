// File size limits in bytes
export const FILE_SIZE_LIMITS = {
  AUDIO: 100 * 1024 * 1024, // 100MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  DEFAULT: 50 * 1024 * 1024  // 50MB
} as const;

// Chunk size limits in bytes
export const CHUNK_SIZE_LIMITS = {
  WHISPER: 24 * 1024 * 1024,  // 24MB (Whisper API limit)
  UPLOAD: 24 * 1024 * 1024,   // 24MB (Standardized with Whisper)
  DEFAULT: 5 * 1024 * 1024    // 5MB (For other file types)
} as const;

// File type categories
export const FILE_TYPES = {
  AUDIO: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/webm'],
  VIDEO: ['video/mp4', 'video/webm'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  DATA: ['application/json', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
} as const;

// Get size limit based on file type
export function getFileSizeLimit(mimeType: string): number {
  if (FILE_TYPES.AUDIO.includes(mimeType) || FILE_TYPES.VIDEO.includes(mimeType)) {
    return FILE_SIZE_LIMITS.AUDIO;
  }
  return FILE_SIZE_LIMITS.DEFAULT;
}

// Get chunk size based on file type
export function getChunkSize(mimeType: string): number {
  if (FILE_TYPES.AUDIO.includes(mimeType)) {
    return CHUNK_SIZE_LIMITS.WHISPER;
  }
  return CHUNK_SIZE_LIMITS.DEFAULT;
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Validate file size
export function validateFileSize(file: File): { valid: boolean; message?: string } {
  const limit = getFileSizeLimit(file.type);
  if (file.size > limit) {
    return {
      valid: false,
      message: `File size exceeds the limit (${formatFileSize(limit)})`
    };
  }
  return { valid: true };
}

// Error messages
export const ERROR_MESSAGES = {
  FILE_SIZE_EXCEEDED: 'File size exceeds the limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  PROCESSING_ERROR: 'Error processing file',
  UPLOAD_ERROR: 'Error uploading file',
  NETWORK_ERROR: 'Network error',
  AUTH_ERROR: 'Authentication error',
  PERMISSION_ERROR: 'Permission denied',
  UNKNOWN_ERROR: 'An unknown error occurred'
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: 'File uploaded successfully',
  PROCESSING_COMPLETE: 'Processing complete',
  CHANGES_SAVED: 'Changes saved successfully',
  OPERATION_COMPLETE: 'Operation completed successfully'
} as const;

// Status messages
export const STATUS_MESSAGES = {
  UPLOADING: 'Uploading...',
  PROCESSING: 'Processing...',
  SAVING: 'Saving...',
  LOADING: 'Loading...',
  PREPARING: 'Preparing...',
  ANALYZING: 'Analyzing...',
  EXTRACTING: 'Extracting content...',
  COMPLETING: 'Completing...'
} as const;

// Button labels
export const BUTTON_LABELS = {
  UPLOAD: 'Upload',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  CONFIRM: 'Confirm',
  CLOSE: 'Close',
  EDIT: 'Edit',
  CREATE: 'Create',
  UPDATE: 'Update'
} as const;

// Form labels
export const FORM_LABELS = {
  NAME: 'Name',
  DESCRIPTION: 'Description',
  TYPE: 'Type',
  SIZE: 'Size',
  DATE: 'Date',
  STATUS: 'Status',
  ACTIONS: 'Actions'
} as const;

// Placeholder texts
export const PLACEHOLDERS = {
  SEARCH: 'Search...',
  NAME: 'Enter name...',
  DESCRIPTION: 'Enter description...',
  MESSAGE: 'Type your message...',
  EMAIL: 'Enter email...',
  PASSWORD: 'Enter password...'
} as const;

// Validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_PASSWORD: 'Invalid password format',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_FORMAT: 'Invalid format'
} as const;