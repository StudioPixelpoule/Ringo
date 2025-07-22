import JSZip from 'jszip';

interface SlideContent {
  slideNumber: number;
  text: string;
  notes?: string;
}

export async function parsePPTX(file: File): Promise<string> {
  try {
    // Lire le fichier comme ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Ouvrir le fichier PPTX avec JSZip (PPTX est un fichier ZIP)
    const zip = new JSZip();
    const pptx = await zip.loadAsync(arrayBuffer);
    
    // Récupérer la liste des slides
    const slides: SlideContent[] = [];
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
    
    // Extraire aussi les métadonnées si disponibles
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
    
    return content;
    
  } catch (error) {
    console.error('Erreur lors du parsing PPTX:', error);
    throw new Error(`Impossible d'extraire le contenu du fichier PowerPoint: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

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
  
  // Joindre les textes avec des espaces
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

// Fonction pour extraire le contenu d'une balise spécifique
function extractTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Fonction pour détecter si c'est un fichier PPT ancien (format binaire)
export function isOldPPTFormat(file: File): boolean {
  return file.name.toLowerCase().endsWith('.ppt') && !file.name.toLowerCase().endsWith('.pptx');
} 