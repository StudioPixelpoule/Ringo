import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Initialize PDF.js worker
const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount?: number;
}

interface PDFPage {
  pageNumber: number;
  text: string;
  structure: {
    title?: string;
    headings: string[];
    paragraphs: string[];
    lists: string[][];
    tables: string[][];
  };
  confidence: number;
}

interface ProcessedPDF {
  metadata: PDFMetadata;
  pages: PDFPage[];
  text: string;
  structure: {
    title?: string;
    abstract?: string;
    sections: {
      heading?: string;
      content: string;
    }[];
  };
  confidence: number;
  processingDate: string;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectLanguage(text: string): string {
  const frenchWords = /^(le|la|les|un|une|des|ce|cette|ces|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc|car|ni|or|par|pour|en|dans|sur|sous|avec|sans|chez|vers|de|du|au|aux)\s/i;
  return frenchWords.test(text) ? 'fra' : 'eng';
}

function detectStructure(text: string, fontSize?: number, fontName?: string): {
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

  // Detect tables (simple heuristic based on tab characters or multiple spaces)
  if (text.includes('\t') || /\s{3,}/.test(text)) {
    return { type: 'table', content: text };
  }

  // Default to paragraph
  return { type: 'paragraph', content: text };
}

async function processPageWithOCR(canvas: HTMLCanvasElement, language: string): Promise<{
  text: string;
  confidence: number;
}> {
  const worker = await createWorker();
  try {
    await worker.loadLanguage(language);
    await worker.initialize(language);
    
    const { data } = await worker.recognize(canvas);
    return {
      text: cleanText(data.text),
      confidence: data.confidence / 100
    };
  } finally {
    await worker.terminate();
  }
}

async function extractPageText(page: any): Promise<{
  text: string;
  structure: PDFPage['structure'];
}> {
  const content = await page.getTextContent({ normalizeWhitespace: true });
  const items = content.items as any[];
  
  let text = '';
  const structure: PDFPage['structure'] = {
    headings: [],
    paragraphs: [],
    lists: [],
    tables: []
  };

  let currentParagraph = '';
  let currentList: string[] = [];
  let currentTable: string[][] = [];
  let lastY: number | null = null;
  let lastFontSize: number | null = null;

  for (const item of items) {
    const itemText = item.str.trim();
    if (!itemText) continue;

    const y = Math.round(item.transform[5]);
    const fontSize = Math.round(item.transform[0]);
    const { type, content } = detectStructure(itemText, fontSize, item.fontName);

    // Handle different types of content
    switch (type) {
      case 'heading':
        if (currentParagraph) {
          structure.paragraphs.push(cleanText(currentParagraph));
          currentParagraph = '';
        }
        structure.headings.push(content);
        break;

      case 'list':
        if (currentParagraph) {
          structure.paragraphs.push(cleanText(currentParagraph));
          currentParagraph = '';
        }
        currentList.push(content);
        break;

      case 'table':
        if (currentParagraph) {
          structure.paragraphs.push(cleanText(currentParagraph));
          currentParagraph = '';
        }
        if (!lastY || Math.abs(y - lastY) > fontSize) {
          if (currentTable.length > 0) {
            structure.tables.push([...currentTable]);
            currentTable = [];
          }
          currentTable.push([content]);
        } else {
          currentTable[currentTable.length - 1].push(content);
        }
        break;

      default:
        if (currentList.length > 0) {
          structure.lists.push([...currentList]);
          currentList = [];
        }
        if (lastY && Math.abs(y - lastY) > fontSize * 1.5) {
          currentParagraph += '\n';
        }
        currentParagraph += (currentParagraph ? ' ' : '') + content;
    }

    text += itemText + ' ';
    lastY = y;
    lastFontSize = fontSize;
  }

  // Add remaining content
  if (currentParagraph) {
    structure.paragraphs.push(cleanText(currentParagraph));
  }
  if (currentList.length > 0) {
    structure.lists.push(currentList);
  }
  if (currentTable.length > 0) {
    structure.tables.push(currentTable);
  }

  return {
    text: cleanText(text),
    structure
  };
}

async function processPDFPage(page: any, scale = 2.0): Promise<PDFPage> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // First try normal text extraction
  let { text, structure } = await extractPageText(page);
  let confidence = 1.0;

  // If text extraction yields poor results, try OCR
  if (!text || text.length < 100) {
    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const language = detectLanguage(text || '');
    const ocrResult = await processPageWithOCR(canvas, language);
    
    text = ocrResult.text;
    confidence = ocrResult.confidence;
  }

  return {
    pageNumber: page.pageNumber,
    text,
    structure,
    confidence
  };
}

export async function processPDF(file: File): Promise<ProcessedPDF> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Extract metadata
    const metadata = await pdf.getMetadata();
    const info = metadata.info || {};
    
    const processedPages: PDFPage[] = [];
    let totalConfidence = 0;
    
    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const processedPage = await processPDFPage(page);
      processedPages.push(processedPage);
      totalConfidence += processedPage.confidence;
    }

    // Analyze overall document structure
    const title = processedPages[0]?.structure.headings[0] || info.Title;
    const abstract = processedPages[0]?.structure.paragraphs[0];
    
    const sections = processedPages.flatMap(page => 
      page.structure.headings.map((heading, index) => ({
        heading,
        content: page.structure.paragraphs[index] || ''
      }))
    );

    // Combine all text
    const fullText = processedPages.map(page => page.text).join('\n\n');

    const result: ProcessedPDF = {
      metadata: {
        title: info.Title,
        author: info.Author,
        subject: info.Subject,
        keywords: info.Keywords?.split(',').map(k => k.trim()),
        creator: info.Creator,
        producer: info.Producer,
        creationDate: info.CreationDate,
        modificationDate: info.ModDate,
        pageCount: pdf.numPages
      },
      pages: processedPages,
      text: fullText,
      structure: {
        title,
        abstract,
        sections
      },
      confidence: totalConfidence / processedPages.length,
      processingDate: new Date().toISOString()
    };

    return result;
  } catch (error) {
    console.error('[PDF Processing] Error:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}