// Limites de l'application
export const MAX_DOCUMENTS_PER_CONVERSATION = 16; // Augmenté à 16 documents grâce au mode hybride
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_AUDIO_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// Limites de tokens pour GPT-4o et Claude
export const MAX_TOKENS = 128000; // Fenêtre de contexte GPT-4o
export const MAX_TOKENS_CLAUDE = 200000; // Fenêtre de contexte Claude
export const MAX_TOKENS_PER_DOC = Math.floor(MAX_TOKENS * 0.90); // 90% pour supporter plus de documents sans compression
export const MAX_SYSTEM_TOKENS = 2000; // Réserver 2K tokens pour les messages système
export const MAX_HISTORY_TOKENS = 3000; // Réduit de 4K à 3K pour libérer plus d'espace
export const MAX_RESPONSE_TOKENS = 4000; // Réserver 4K tokens pour la réponse

// Messages d'erreur
export const ERROR_MESSAGES = {
  DOCUMENT_LIMIT: `Limite de ${MAX_DOCUMENTS_PER_CONVERSATION} documents par conversation atteinte. Créez une nouvelle conversation pour analyser d'autres documents.`,
  TOKEN_LIMIT: 'Désolé, le contexte des documents est trop volumineux. Essayez avec moins de documents ou des questions plus spécifiques.',
  RATE_LIMIT: 'Désolé, trop de requêtes ont été effectuées. Veuillez patienter quelques instants avant de réessayer.',
  GENERIC_ERROR: 'Désolé, une erreur s\'est produite lors de la génération de la réponse.'
};

// Feature flags
export const FEATURE_FLAGS = {
  USE_HYBRID_MODE: true, // Mode hybride GPT-4o + Claude activé
  HYBRID_MODE_DOCUMENT_THRESHOLD: 6, // Utiliser Claude au-delà de 6 documents
  FORCE_OPENAI_FALLBACK: false, // Mode hybride complet avec bascule automatique
  DISABLE_COMPRESSION: true, // Désactiver la compression par défaut
  ADAPTIVE_COMPRESSION_THRESHOLD: 0.85, // Compresser seulement si on dépasse 85% de la limite de tokens
}; 