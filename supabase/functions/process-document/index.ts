import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import mammoth from "npm:mammoth@1.6.0";
import * as XLSX from "npm:xlsx@0.18.5";
import Papa from "npm:papaparse@5.4.1";
import { safeJsonParse } from './jsonUtils.ts';
import { processMarkdownDocument } from './markdownProcessor.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fonction de détection de langue
function detectLanguage(text: string): string {
  const frenchWords = /\b(le|la|les|un|une|des|de|du|et|est|sont|être|avoir|faire|que|qui|dans|pour|sur|avec|par|sans|sous|entre|vers|chez|contre|depuis|pendant|avant|après|mais|ou|donc|car|ni|si)\b/gi;
  const englishWords = /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|from|up|about|into|through|during|before|after|above|below|between|under|however|therefore|thus|moreover|furthermore|meanwhile|whereas|whereby|wherein)\b/gi;

  const frenchMatches = (text.match(frenchWords) || []).length;
  const englishMatches = (text.match(englishWords) || []).length;

  return frenchMatches > englishMatches ? 'fr' : 'en';
}

// Fonction de nettoyage du texte
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Traitement des fichiers Word
async function processWordDocument(file: File): Promise<any> {
  console.log('[Word Processing] Starting processing:', file.name);
  
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  
  if (!text?.trim()) {
    throw new Error(`Aucun contenu extrait du document: ${file.name}`);
  }
  
  const cleanedText = cleanText(text);
  
  return {
    content: cleanedText,
    metadata: {
      fileName: file.name,
      fileType: file.type,
      language: detectLanguage(cleanedText)
    },
    confidence: 1,
    processingDate: new Date().toISOString()
  };
}

// Traitement des fichiers Excel
async function processExcelDocument(file: File): Promise<any> {
  console.log('[Excel Processing] Starting processing:', file.name);
  
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellText: true
  });
  
  // Extraire toutes les feuilles
  const data: any = {};
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    data[sheetName] = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false
    });
  });
  
  if (!data || Object.keys(data).length === 0) {
    throw new Error('Aucune donnée trouvée dans le fichier Excel');
  }
  
  // Formater les données pour le stockage
  const formattedData = {
    type: 'xlsx',
    fileName: file.name,
    data,
    metadata: {
      rowCount: Object.values(data).reduce((sum: number, sheet: any[]) => sum + sheet.length, 0),
      fields: Object.keys(data).map(sheet => ({
        sheet,
        fields: Object.keys(data[sheet][0] || {})
      })),
      size: file.size,
      sheets: Object.keys(data)
    },
    processingDate: new Date().toISOString()
  };
  
  return {
    content: JSON.stringify(formattedData, null, 2),
    metadata: {
      fileName: file.name,
      fileType: file.type,
      language: 'unknown',
      sheets: Object.keys(data),
      totalRows: formattedData.metadata.rowCount
    },
    confidence: 1,
    processingDate: new Date().toISOString()
  };
}

// Traitement des fichiers CSV
async function processCSVDocument(file: File): Promise<any> {
  console.log('[CSV Processing] Starting processing:', file.name);
  
  const text = await file.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t', '|'],
      complete: (parseResult) => {
        if (parseResult.errors?.length > 0) {
          console.warn('CSV parsing warnings:', parseResult.errors);
        }
        
        const data = parseResult.data;
        
        if (!Array.isArray(data) || data.length === 0) {
          reject(new Error('Aucune donnée trouvée dans le fichier CSV'));
          return;
        }
        
        // Formater les données pour le stockage
        const formattedData = {
          type: 'csv',
          fileName: file.name,
          data,
          metadata: {
            rowCount: data.length,
            fields: Object.keys(data[0] || {}),
            size: file.size
          },
          processingDate: new Date().toISOString()
        };
        
        resolve({
          content: JSON.stringify(formattedData, null, 2),
          metadata: {
            fileName: file.name,
            fileType: file.type,
            language: 'unknown',
            totalRows: data.length,
            columns: Object.keys(data[0] || {})
          },
          confidence: 1,
          processingDate: new Date().toISOString()
        });
      },
      error: (error) => {
        reject(new Error(`Erreur lors du parsing CSV: ${error.message}`));
      }
    });
  });
}

// Traitement des fichiers JSON
async function processJSONDocument(file: File): Promise<any> {
  console.log('[JSON Processing] Starting processing:', file.name);
  
  const text = await file.text();
  const parseResult = safeJsonParse(text);
  
  if (parseResult.error) {
    console.warn('[JSON Processing] Warning:', parseResult.error);
    console.log('[JSON Processing] First 100 chars:', text.substring(0, 100));
  }
  
  const data = parseResult.data;
  
  // Formater les données pour le stockage
  const formattedData = {
    type: 'json',
    fileName: file.name,
    data,
    metadata: {
      rowCount: Array.isArray(data) ? data.length : 1,
      fields: Array.isArray(data) ? Object.keys(data[0] || {}) : Object.keys(data || {}),
      size: file.size
    },
    processingDate: new Date().toISOString()
  };
  
  return {
    content: JSON.stringify(formattedData, null, 2),
    metadata: {
      fileName: file.name,
      fileType: file.type,
      language: 'unknown',
      isArray: Array.isArray(data),
      itemCount: Array.isArray(data) ? data.length : Object.keys(data).length
    },
    confidence: 1,
    processingDate: new Date().toISOString()
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Récupérer le fichier
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('Aucun fichier fourni');
    }

    console.log('[Document Processing] Processing file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    let result;
    const extension = file.name.split('.').pop()?.toLowerCase();

    // Router vers le bon processeur selon le type
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        extension === 'docx') {
      result = await processWordDocument(file);
    } 
    else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
             file.type === 'application/vnd.ms-excel' ||
             extension === 'xlsx' || extension === 'xls') {
      result = await processExcelDocument(file);
    }
    else if (file.type === 'text/csv' || extension === 'csv') {
      result = await processCSVDocument(file);
    }
    else if (file.type === 'application/json' || extension === 'json') {
      result = await processJSONDocument(file);
    }
    else if (['md', 'markdown', 'mdown', 'mkd', 'mdx'].includes(extension || '') || 
             file.type === 'text/markdown' || 
             file.type === 'text/x-markdown') {
      // Traiter les fichiers Markdown
      result = await processMarkdownDocument(file);
    }
    else if (file.type === 'text/plain' || extension === 'txt') {
      // Vérifier si c'est un Markdown déguisé en text/plain
      if (['md', 'markdown', 'mdown', 'mkd'].includes(extension || '')) {
        result = await processMarkdownDocument(file);
      } else {
        // Traiter comme un document texte simple
        const text = await file.text();
        result = {
          content: cleanText(text),
          metadata: {
            fileName: file.name,
            fileType: file.type,
            language: detectLanguage(text)
          },
          confidence: 1,
          processingDate: new Date().toISOString()
        };
      }
    }
    else {
      throw new Error(`Type de fichier non supporté: ${file.type || extension}`);
    }

    console.log('[Document Processing] Processing completed successfully');

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Document Processing] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors du traitement du document'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
}); 