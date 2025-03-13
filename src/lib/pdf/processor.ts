import * as pdfjsLib from 'pdfjs-dist';
import { ProcessedPDF, ProcessingProgress } from './types';
import { cleanText, detectLanguage } from './utils';
import { extractPageText } from './extraction';
import { processPageWithOCR } from './ocr';

// Initialize PDF.js worker
const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function processPDF(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<ProcessedPDF> {
  if (signal?.aborted) {
    throw new Error('Traitement annulé');
  }

  onProgress?.({
    stage: 'preparation',
    progress: 10,
    message: 'Analyse du document PDF...',
    canCancel: true
  });

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const metadata = await pdf.getMetadata();

  const pages = [];
  let totalConfidence = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    if (signal?.aborted) {
      throw new Error('Traitement annulé');
    }

    onProgress?.({
      stage: 'processing',
      progress: 10 + (i / pdf.numPages) * 80,
      message: `Traitement de la page ${i}/${pdf.numPages}...`,
      canCancel: true
    });

    const page = await pdf.getPage(i);
    let { text, structure } = await extractPageText(page);
    let confidence = 1.0;

    // Si peu de texte détecté, essayer l'OCR
    if (text.length < 100) {
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const ocrResult = await processPageWithOCR(canvas, detectLanguage(text));
        
        if (ocrResult.text.length > text.length) {
          text = cleanText(ocrResult.text);
          confidence = ocrResult.confidence;
        }
      }
    }

    pages.push({
      pageNumber: i,
      text,
      structure,
      confidence
    });

    totalConfidence += confidence;
  }

  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: 'Traitement terminé',
    canCancel: false
  });

  // Analyse de la structure globale
  const sections = pages.flatMap((page, index) => {
    return page.structure.headings.map((heading, i) => ({
      heading,
      content: page.structure.paragraphs[i] || '',
      pageNumber: index + 1
    }));
  });

  return {
    metadata: {
      title: metadata.info?.Title || sections[0]?.heading,
      author: metadata.info?.Author,
      subject: metadata.info?.Subject,
      keywords: metadata.info?.Keywords?.split(',').map(k => k.trim()),
      creator: metadata.info?.Creator,
      producer: metadata.info?.Producer,
      creationDate: metadata.info?.CreationDate,
      modificationDate: metadata.info?.ModDate,
      pageCount: pdf.numPages
    },
    pages,
    text: pages.map(p => p.text).join('\n\n'),
    structure: {
      title: sections[0]?.heading,
      abstract: pages[0]?.structure.paragraphs[0],
      sections
    },
    confidence: totalConfidence / pages.length,
    processingDate: new Date().toISOString()
  };
}