import { PDFPage } from './types';
import { cleanText, detectStructure } from './utils';

export async function extractPageText(page: any): Promise<{
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