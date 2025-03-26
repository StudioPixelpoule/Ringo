import { logError } from './errorLogger';
import { config } from './config';

interface ExtractionProgress {
  stage: 'preparation' | 'fetching' | 'processing' | 'complete';
  progress: number;
  message: string;
}

interface ExtractionOptions {
  onProgress?: (progress: ExtractionProgress) => void;
  signal?: AbortSignal;
}

interface ExtractionResult {
  title: string;
  content: string;
  metadata: {
    url: string;
    timestamp: string;
    language?: string;
    wordCount: number;
    hasImages: boolean;
  };
}

// Fallback strategies for content extraction
const EXTRACTION_STRATEGIES = {
  // Main content selectors in order of preference
  CONTENT_SELECTORS: [
    'article',
    'main',
    '[role="main"]',
    '.main-content',
    '.content',
    '.post-content',
    '#content',
    '.article',
    '.entry-content'
  ],

  // Noise selectors to remove
  NOISE_SELECTORS: [
    'header',
    'footer',
    'nav',
    '.nav',
    '.navigation',
    '.menu',
    '.sidebar',
    '.comments',
    '.advertisement',
    '.social-share',
    'script',
    'style',
    'iframe',
    'form'
  ],

  // Metadata selectors
  META_SELECTORS: {
    title: [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'h1',
      'title'
    ],
    description: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]'
    ],
    language: [
      'html[lang]',
      'meta[property="og:locale"]'
    ]
  }
} as const;

function createDOMParser(): DOMParser {
  return new DOMParser();
}

function extractMetadata(doc: Document): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Extract metadata using defined selectors
  for (const [key, selectors] of Object.entries(EXTRACTION_STRATEGIES.META_SELECTORS)) {
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        if (element.hasAttribute('content')) {
          metadata[key] = element.getAttribute('content') || '';
        } else if (element.hasAttribute('lang')) {
          metadata[key] = element.getAttribute('lang') || '';
        } else {
          metadata[key] = element.textContent?.trim() || '';
        }
        break;
      }
    }
  }

  return metadata;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

function extractMainContent(doc: Document): string {
  let content = '';
  let mainElement: Element | null = null;

  // Try each content selector until we find meaningful content
  for (const selector of EXTRACTION_STRATEGIES.CONTENT_SELECTORS) {
    const element = doc.querySelector(selector);
    if (element && element.textContent && element.textContent.length > 100) {
      mainElement = element;
      break;
    }
  }

  // If no main content found, use body as fallback
  if (!mainElement) {
    mainElement = doc.body;
  }

  // Clone the element to avoid modifying original
  const workingElement = mainElement.cloneNode(true) as Element;

  // Remove noise elements
  EXTRACTION_STRATEGIES.NOISE_SELECTORS.forEach(selector => {
    workingElement.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Extract text content with basic formatting
  const paragraphs = Array.from(workingElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li'));
  content = paragraphs
    .map(p => {
      const text = p.textContent?.trim() || '';
      if (p.tagName.toLowerCase().startsWith('h')) {
        return `\n## ${text}\n`;
      }
      if (p.tagName.toLowerCase() === 'li') {
        return `- ${text}`;
      }
      return text;
    })
    .join('\n\n');

  return cleanText(content);
}

async function extractWithOpenAI(html: string, url: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Extract and structure the main content from HTML, removing navigation, ads, and other non-essential elements. Format the content using Markdown.

Instructions:
1. Focus on the main content
2. Remove navigation menus, ads, footers
3. Preserve important headings and structure
4. Format using Markdown
5. Include metadata like title and main topics
6. Keep all relevant text content
7. Preserve lists and tables
8. Remove any script or style content`
          },
          {
            role: 'user',
            content: `Extract and structure the content from this HTML. URL: ${url}\n\nHTML Content:\n${html}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error('Failed to process web content with OpenAI');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    logError(error, {
      component: 'webContentExtractor',
      action: 'extractWithOpenAI',
      url
    });
    throw error;
  }
}

export async function extractWebContent(
  url: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { onProgress, signal } = options;

  try {
    onProgress?.({
      stage: 'fetching',
      progress: 10,
      message: 'Récupération du contenu...'
    });

    // Validate URL
    const targetUrl = new URL(url);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      throw new Error('URL invalide: le protocole doit être HTTP ou HTTPS');
    }

    // Fetch content with CORS proxy
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl.href)}`;
    const response = await fetch(proxyUrl, {
      signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const html = await response.text();
    if (!html.trim()) {
      throw new Error('Le contenu de la page est vide');
    }

    onProgress?.({
      stage: 'processing',
      progress: 30,
      message: 'Analyse du contenu...'
    });

    // Parse HTML
    const parser = createDOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract metadata
    const metadata = extractMetadata(doc);

    // Try direct extraction first
    let content = extractMainContent(doc);
    let extractionMethod = 'direct';

    // If direct extraction yields poor results, try OpenAI
    if (content.length < 500 || content.split('\n').length < 5) {
      onProgress?.({
        stage: 'processing',
        progress: 60,
        message: 'Utilisation de l\'IA pour améliorer l\'extraction...'
      });

      try {
        content = await extractWithOpenAI(html, url);
        extractionMethod = 'openai';
      } catch (error) {
        logError(error, {
          component: 'webContentExtractor',
          action: 'openaiExtraction',
          url
        });
        // Continue with direct extraction result if OpenAI fails
      }
    }

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Extraction terminée'
    });

    // Count words and detect images
    const wordCount = content.split(/\s+/).length;
    const hasImages = doc.querySelectorAll('img[src]').length > 0;

    return {
      title: metadata.title || targetUrl.hostname,
      content,
      metadata: {
        url: targetUrl.href,
        timestamp: new Date().toISOString(),
        language: metadata.language?.split('-')[0] || 'fr',
        wordCount,
        hasImages
      }
    };
  } catch (error) {
    logError(error, {
      component: 'webContentExtractor',
      action: 'extractWebContent',
      url
    });
    throw error;
  }
}