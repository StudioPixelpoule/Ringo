import { createWorker } from 'tesseract.js';
import { detectLanguage } from './utils';

export async function processPageWithOCR(
  canvas: HTMLCanvasElement,
  language: string
): Promise<{
  text: string;
  confidence: number;
}> {
  const worker = await createWorker();
  try {
    await worker.loadLanguage(language);
    await worker.initialize(language);
    
    const { data } = await worker.recognize(canvas);
    return {
      text: data.text,
      confidence: data.confidence / 100
    };
  } finally {
    await worker.terminate();
  }
}