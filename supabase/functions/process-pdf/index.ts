import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import pdfParse from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fonction simple de nettoyage du texte
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Fonction simple de détection de langue
function detectLanguage(text: string): string {
  const frenchWords = /\b(le|la|les|un|une|des|de|du|et|est|sont|être|avoir|faire|que|qui|dans|pour|sur|avec|par|sans|sous|entre|vers|chez|contre|depuis|pendant|avant|après|mais|ou|donc|car|ni|si)\b/gi;
  const englishWords = /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|from|up|about|into|through|during|before|after|above|below|between|under|however|therefore|thus|moreover|furthermore|meanwhile|whereas|whereby|wherein)\b/gi;

  const frenchMatches = (text.match(frenchWords) || []).length;
  const englishMatches = (text.match(englishWords) || []).length;

  return frenchMatches > englishMatches ? 'fr' : 'en';
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

    // Récupérer le fichier PDF
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('Aucun fichier fourni');
    }

    // Vérifier le type de fichier
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Le fichier doit être un PDF');
    }

    console.log('[PDF Processing] Starting processing:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';
    let metadata: any = {};
    let pageCount = 0;

    try {
      // Extraire le texte avec pdf-parse
      const data = await pdfParse(buffer);
      
      extractedText = data.text;
      pageCount = data.numpages;
      
      // Extraire les métadonnées
      if (data.info) {
        metadata = {
          title: data.info.Title,
          author: data.info.Author,
          subject: data.info.Subject,
          keywords: data.info.Keywords,
          creator: data.info.Creator,
          producer: data.info.Producer,
          creationDate: data.info.CreationDate,
          modDate: data.info.ModDate
        };
      }

      console.log('[PDF Processing] Text extraction successful:', {
        textLength: extractedText.length,
        pageCount: pageCount
      });

    } catch (parseError) {
      console.error('[PDF Processing] Error parsing PDF:', parseError);
      throw new Error('Erreur lors de l\'extraction du texte du PDF');
    }

    // Nettoyer le texte extrait
    const cleanedText = cleanText(extractedText);

    if (!cleanedText) {
      // Si aucun texte n'a été extrait, le PDF contient probablement des images
      // Dans un cas réel, on pourrait implémenter l'OCR ici
      console.warn('[PDF Processing] No text extracted, PDF might contain only images');
      
      const placeholderContent = `
# Document PDF : ${file.name}

**Type :** ${file.type}
**Taille :** ${(file.size / 1024 / 1024).toFixed(2)} MB
**Pages :** ${pageCount}

⚠️ **Note :** Ce PDF semble contenir principalement des images ou du contenu scanné.
L'extraction de texte n'a pas pu récupérer de contenu textuel.

Pour une meilleure extraction, veuillez utiliser un PDF avec du texte sélectionnable
ou un service d'OCR externe.

Le fichier a été enregistré et vous pouvez poser des questions générales à son sujet.
`;
      
      const result = {
        content: placeholderContent,
        metadata: {
          ...metadata,
          fileName: file.name,
          fileType: file.type,
          language: 'fr',
          pageCount: pageCount
        },
        confidence: 0.3,
        processingDate: new Date().toISOString()
      };

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Détecter la langue
    const detectedLanguage = detectLanguage(cleanedText);

    // Formater le résultat
    const result = {
      content: cleanedText,
      metadata: {
        ...metadata,
        fileName: file.name,
        fileType: file.type,
        language: detectedLanguage,
        pageCount: pageCount
      },
      confidence: 0.95, // Haute confiance car extraction directe
      processingDate: new Date().toISOString()
    };

    console.log('[PDF Processing] Processing completed successfully');

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[PDF Processing] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors du traitement du PDF'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
}); 