// Utilitaires pour le traitement PDF
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectLanguage(text: string): string {
  const frenchPattern = /^(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc)\s/i;
  return frenchPattern.test(text) ? 'fra' : 'eng';
}

export function detectStructure(text: string, fontSize?: number, fontName?: string): {
  type: 'heading' | 'paragraph' | 'list' | 'table';
  content: string;
} {
  // Detect headings based on font properties or patterns
  if (
    (fontSize && fontSize > 12) ||
    (fontName && /bold|heavy|head/i.test(fontName)) ||
    /^[A-Z\d\s]{10,}$/.test(text) ||
    /^(?:CHAPITRE|SECTION|PARTIE)\s+[\d\w]/i.test(text)
  ) {
    return { type: 'heading', content: text };
  }

  // Detect lists
  if (/^[\u2022\-\*]\s/.test(text) || /^\d+[\.\)]\s/.test(text)) {
    return { type: 'list', content: text };
  }

  // Detect tables
  if (text.includes('\t') || /\s{3,}/.test(text)) {
    return { type: 'table', content: text };
  }

  // Default to paragraph
  return { type: 'paragraph', content: text };
}