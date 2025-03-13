import mammoth from 'mammoth';
import { ProcessingResult, ProcessingProgress } from './types';
import { cleanText, detectLanguage } from './utils';

export async function processWordDocument(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<ProcessingResult> {
  if (signal?.aborted) {
    throw new Error('Traitement annulé');
  }

  onProgress?.({
    stage: 'processing',
    progress: 30,
    message: 'Extraction du contenu Word...',
    canCancel: true
  });

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = cleanText(result.value);

  // Analyse de la structure
  const lines = text.split('\n');
  const sections: Array<{
    heading?: string;
    content: string;
  }> = [];

  let currentSection = { content: '' };
  let abstract = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    if (
      trimmedLine.toUpperCase() === trimmedLine ||
      /^\d+[.\s]/.test(trimmedLine)
    ) {
      if (currentSection.content) {
        sections.push({ ...currentSection });
      }
      currentSection = {
        heading: trimmedLine,
        content: ''
      };
    } else {
      if (!abstract && !currentSection.heading) {
        abstract = trimmedLine;
      } else {
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
      }
    }
  });

  if (currentSection.content) {
    sections.push(currentSection);
  }

  return {
    content: text,
    metadata: {
      title: sections[0]?.heading,
      fileType: file.type,
      fileName: file.name,
      language: detectLanguage(text)
    },
    structure: {
      title: sections[0]?.heading,
      abstract,
      sections
    },
    confidence: 1,
    processingDate: new Date().toISOString()
  };
}