import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { processAudioFile } from './audioProcessor';

// Initialize PDF.js worker
const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface ProcessingResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    date?: string;
    language?: string;
    pageCount?: number;
    fileType: string;
    fileName: string;
  };
  structure: {
    title?: string;
    abstract?: string;
    sections: Array<{
      heading?: string;
      content: string;
      pageNumber?: number;
    }>;
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
  const frenchPattern = /^(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc)\s/i;
  return frenchPattern.test(text) ? 'fra' : 'eng';
}

async function extractPDFText(file: File): Promise<ProcessingResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const metadata = await pdf.getMetadata();

  const pages: Array<{ text: string; items: any[] }> = [];
  let totalConfidence = 0;

  // Process each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    
    let pageText = '';
    const items = content.items as any[];
    
    // Extract text while preserving structure
    let lastY: number | null = null;
    let currentLine = '';
    
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      const text = item.str.trim();
      
      if (!text) continue;
      
      // Detect line breaks based on vertical position
      if (lastY !== null && Math.abs(y - lastY) > item.height) {
        if (currentLine) {
          pageText += currentLine + '\n';
          currentLine = '';
        }
      }
      
      currentLine += (currentLine && Math.abs(item.transform[4] - items[items.length - 1]?.transform[4]) < 5 ? ' ' : '') + text;
      lastY = y;
    }
    
    if (currentLine) {
      pageText += currentLine;
    }

    pages.push({
      text: cleanText(pageText),
      items
    });

    // If page has very little text, try OCR
    if (pageText.length < 100) {
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
        
        const worker = await createWorker();
        const lang = detectLanguage(pageText);
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        
        const { data } = await worker.recognize(canvas);
        await worker.terminate();
        
        if (data.text.length > pageText.length) {
          pages[i - 1].text = cleanText(data.text);
          totalConfidence += data.confidence / 100;
        } else {
          totalConfidence += 1;
        }
      }
    } else {
      totalConfidence += 1;
    }
  }

  // Extract document structure
  const sections: ProcessingResult['structure']['sections'] = [];
  let currentSection = { content: '' };
  let abstract = '';

  pages.forEach((page, pageIndex) => {
    const lines = page.text.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Detect headings (all caps, numbered, or larger font)
      const isHeading = 
        trimmedLine.toUpperCase() === trimmedLine ||
        /^\d+[.\s]/.test(trimmedLine) ||
        page.items.some(item => 
          item.str.includes(trimmedLine) && 
          (item.transform[0] > 12 || item.fontName?.toLowerCase().includes('bold'))
        );

      if (isHeading) {
        if (currentSection.content) {
          sections.push({ ...currentSection, pageNumber: pageIndex + 1 });
        }
        currentSection = {
          heading: trimmedLine,
          content: '',
          pageNumber: pageIndex + 1
        };
      } else {
        // First non-heading paragraph is considered abstract
        if (!abstract && !currentSection.heading && pageIndex === 0) {
          abstract = trimmedLine;
        } else {
          currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
        }
      }
    });
  });

  // Add final section
  if (currentSection.content) {
    sections.push(currentSection);
  }

  // Combine all text
  const fullText = pages.map(p => p.text).join('\n\n');

  return {
    text: fullText,
    metadata: {
      title: metadata.info?.Title || sections[0]?.heading,
      author: metadata.info?.Author,
      date: metadata.info?.CreationDate,
      language: detectLanguage(fullText),
      pageCount: pdf.numPages,
      fileType: file.type,
      fileName: file.name
    },
    structure: {
      title: sections[0]?.heading,
      abstract,
      sections
    },
    confidence: totalConfidence / pdf.numPages,
    processingDate: new Date().toISOString()
  };
}

async function processTextDocument(file: File): Promise<ProcessingResult> {
  let text = '';
  let confidence = 1;

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    text = result.value;
  } else {
    text = await file.text();
  }

  text = cleanText(text);
  const language = detectLanguage(text);

  // Extract structure
  const lines = text.split('\n');
  const sections: ProcessingResult['structure']['sections'] = [];
  let currentSection = { content: '' };
  let abstract = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    if (trimmedLine.toUpperCase() === trimmedLine || /^\d+[.\s]/.test(trimmedLine)) {
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
    text,
    metadata: {
      title: sections[0]?.heading,
      date: new Date().toISOString(),
      language,
      fileType: file.type,
      fileName: file.name
    },
    structure: {
      title: sections[0]?.heading,
      abstract,
      sections
    },
    confidence,
    processingDate: new Date().toISOString()
  };
}

export async function processDocument(file: File): Promise<string> {
  try {
    let result: any;

    switch (file.type.toLowerCase()) {
      case 'application/pdf':
        result = await extractPDFText(file);
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'text/plain':
        result = await processTextDocument(file);
        break;
      case 'audio/mpeg':
      case 'audio/wav':
      case 'audio/x-wav':
      case 'audio/mp3':
        result = await processAudioFile(file);
        break;
      default:
        throw new Error(`Type de fichier non supporté: ${file.type}`);
    }

    return JSON.stringify(result);
  } catch (error) {
    console.error('[Document Processing] Error:', error);
    throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}