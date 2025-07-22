import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fonction pour extraire le texte d'un XML PowerPoint
function extractTextFromXML(xml: string): string {
  const texts: string[] = [];
  
  // Regex pour trouver tous les contenus de balises <a:t>
  const textRegex = /<a:t[^>]*>([^<]+)<\/a:t>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    
    if (text) {
      texts.push(text);
    }
  }
  
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

// Fonction pour extraire le contenu d'une balise spécifique
function extractTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Get auth token from headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Processing presentation file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Vérifier si c'est un ancien format PPT
    if (file.name.toLowerCase().endsWith('.ppt') && !file.name.toLowerCase().endsWith('.pptx')) {
      const result = {
        content: `# Fichier PowerPoint (Format ancien) : ${file.name}

**Type :** ${file.type || 'application/vnd.ms-powerpoint'}
**Taille :** ${(file.size / 1024 / 1024).toFixed(2)} MB

⚠️ **Note :** Ce fichier utilise l'ancien format PowerPoint (.ppt). 
Pour une meilleure extraction du contenu, veuillez convertir ce fichier au format moderne (.pptx).`,
        metadata: {
          fileName: file.name,
          fileType: file.type || 'application/vnd.ms-powerpoint',
          language: 'fr',
          pageCount: 0
        },
        confidence: 0.5,
        processingDate: new Date().toISOString()
      };

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Parser le fichier PPTX
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    const pptx = await zip.loadAsync(new Uint8Array(arrayBuffer));
    
    // Récupérer la liste des slides
    const slides: Array<{ slideNumber: number; text: string; notes?: string }> = [];
    const slideFiles = Object.keys(pptx.files).filter(name => 
      name.match(/^ppt\/slides\/slide\d+\.xml$/)
    ).sort();
    
    // Extraire le contenu de chaque slide
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideNumber = i + 1;
      
      // Extraire le XML du slide
      const slideXml = await pptx.file(slideFile)?.async('string');
      if (!slideXml) continue;
      
      // Extraire le texte du XML
      const slideText = extractTextFromXML(slideXml);
      
      // Chercher les notes du slide
      const notesFile = slideFile.replace('slides/slide', 'notesSlides/notesSlide');
      const notesXml = await pptx.file(notesFile)?.async('string');
      const notesText = notesXml ? extractTextFromXML(notesXml) : undefined;
      
      if (slideText || notesText) {
        slides.push({
          slideNumber,
          text: slideText,
          notes: notesText
        });
      }
    }
    
    // Extraire les métadonnées
    const coreXml = await pptx.file('docProps/core.xml')?.async('string');
    const appXml = await pptx.file('docProps/app.xml')?.async('string');
    
    const title = coreXml ? extractTagContent(coreXml, 'dc:title') : file.name;
    const subject = coreXml ? extractTagContent(coreXml, 'dc:subject') : '';
    const creator = coreXml ? extractTagContent(coreXml, 'dc:creator') : '';
    const slidesCount = appXml ? extractTagContent(appXml, 'Slides') : slides.length.toString();
    
    // Formater le contenu final
    let content = `# Présentation PowerPoint : ${title}\n\n`;
    
    if (subject) {
      content += `**Sujet :** ${subject}\n`;
    }
    if (creator) {
      content += `**Auteur :** ${creator}\n`;
    }
    content += `**Nombre de slides :** ${slidesCount}\n\n`;
    content += `---\n\n`;
    
    // Ajouter le contenu de chaque slide
    for (const slide of slides) {
      content += `## Slide ${slide.slideNumber}\n\n`;
      
      if (slide.text) {
        content += `### Contenu\n${slide.text}\n\n`;
      }
      
      if (slide.notes) {
        content += `### Notes du présentateur\n${slide.notes}\n\n`;
      }
      
      content += `---\n\n`;
    }
    
    const result = {
      content,
      metadata: {
        fileName: file.name,
        fileType: file.type,
        language: 'fr',
        pageCount: slides.length
      },
      confidence: 0.95,
      processingDate: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        result
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-presentation function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while processing presentation'
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 400
      }
    );
  }
}); 