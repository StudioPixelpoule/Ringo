import { supabase } from './supabase';
import type { Document } from './types';
import OpenAI from 'openai';

// Créer une instance OpenAI avec la clé API
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'dummy-key',
  dangerouslyAllowBrowser: true // Nécessaire pour l'utilisation côté client
});

/**
 * Extrait le contenu textuel d'un document à partir de son URL
 * @param document Le document dont on veut extraire le contenu
 * @returns Le contenu textuel du document ou un message d'erreur
 */
export async function extractDocumentContent(document: Document): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Début de l\'extraction pour:', document.name, 'ID:', document.id);
    
    // Vérifier d'abord si le contenu existe déjà dans la base de données
    const existingContent = await getDocumentContent(document.id);
    
    if (existingContent) {
      console.log('[DOCUMENT_EXTRACTION] Contenu trouvé dans la base de données, longueur:', existingContent.length);
      return existingContent;
    }
    
    console.log('[DOCUMENT_EXTRACTION] Aucun contenu existant, début de l\'extraction pour:', document.name);
    
    // Vérifier le type de document
    const fileExtension = document.name.split('.').pop()?.toLowerCase();
    
    console.log('[DOCUMENT_EXTRACTION] Type de fichier détecté:', fileExtension);
    
    // Vérifier si c'est un fichier audio
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '')) {
      console.log('[DOCUMENT_EXTRACTION] Fichier audio détecté, lancement de la transcription');
      const transcription = await transcribeAudio(document.url);
      
      // Stocker la transcription dans la base de données
      await storeDocumentContent(document.id, transcription, 'success');
      
      return transcription;
    }
    
    // Extraire le chemin du fichier depuis l'URL
    const filePath = document.url.split('/').slice(-2).join('/');
    
    console.log('[DOCUMENT_EXTRACTION] Chemin du fichier dans le storage:', filePath);
    
    // Récupérer le contenu du document depuis Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);
    
    if (error) {
      console.error('[DOCUMENT_EXTRACTION] Erreur lors du téléchargement du document:', error);
      const errorMessage = `Impossible d'accéder au contenu du document. Erreur: ${error.message}`;
      await storeDocumentContent(document.id, errorMessage, 'failed');
      return errorMessage;
    }
    
    if (!data) {
      console.error('[DOCUMENT_EXTRACTION] Document vide ou inaccessible');
      const errorMessage = "Le document est vide ou inaccessible.";
      await storeDocumentContent(document.id, errorMessage, 'failed');
      return errorMessage;
    }
    
    console.log('[DOCUMENT_EXTRACTION] Document téléchargé avec succès, taille:', data.size, 'octets');
    
    // Traiter différents types de fichiers
    let extractedContent = '';
    let extractionStatus: 'pending' | 'processing' | 'success' | 'failed' | 'partial' | 'manual' = 'success';
    
    if (fileExtension === 'txt') {
      extractedContent = await extractTextFile(data);
    } else if (fileExtension === 'json') {
      extractedContent = await extractJsonFile(data);
    } else if (fileExtension === 'docx') {
      extractedContent = await extractDocxFile(data);
    } else if (fileExtension === 'doc') {
      extractedContent = await extractDocFile(data);
    } else if (fileExtension === 'pdf') {
      extractedContent = await extractPdfFile(data);
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      extractedContent = await extractExcelFile(data);
    } else if (['pptx', 'ppt'].includes(fileExtension || '')) {
      extractedContent = await extractPowerPointFile();
    } else if (['csv', 'tsv'].includes(fileExtension || '')) {
      extractedContent = await extractCsvFile(data);
    } else if (['html', 'htm'].includes(fileExtension || '')) {
      extractedContent = await extractHtmlFile(data);
    } else {
      // Essayer de lire comme texte pour les autres formats
      extractedContent = await extractGenericFile(data, fileExtension);
      extractionStatus = 'partial';
    }
    
    // Vérifier si l'extraction a échoué
    if (extractedContent.includes("Impossible d'extraire") || 
        extractedContent.includes("Ce format nécessite une conversion") ||
        extractedContent.includes("n'est pas pris en charge")) {
      extractionStatus = 'failed';
    }
    
    // Stocker le contenu dans la base de données
    await storeDocumentContent(document.id, extractedContent, extractionStatus);
    
    console.log('[DOCUMENT_EXTRACTION] Extraction terminée, statut:', extractionStatus, 'longueur:', extractedContent.length);
    
    return extractedContent;
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu du document:', error);
    const message = "Une erreur s'est produite lors de l'extraction du contenu du document. Veuillez réessayer ou copier-coller le contenu manuellement.";
    
    // Tenter de stocker le message d'erreur dans la base de données si document.id est disponible
    if (document && document.id) {
      await storeDocumentContent(document.id, message, 'failed');
    }
    
    return message;
  }
}

/**
 * Extrait le contenu d'un fichier texte
 */
async function extractTextFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu TXT');
    const content = await data.text();
    console.log('[DOCUMENT_EXTRACTION] Contenu TXT extrait, longueur:', content.length);
    return content;
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu TXT:', error);
    return "Impossible d'extraire le contenu du fichier texte.";
  }
}

/**
 * Extrait le contenu d'un fichier JSON
 */
async function extractJsonFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu JSON');
    const jsonContent = await data.text();
    try {
      // Formater le JSON pour une meilleure lisibilité
      const parsedJson = JSON.parse(jsonContent);
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      console.log('[DOCUMENT_EXTRACTION] Contenu JSON extrait et formaté, longueur:', formattedJson.length);
      return formattedJson;
    } catch (e) {
      console.error('[DOCUMENT_EXTRACTION] Erreur lors du parsing JSON:', e);
      return jsonContent;
    }
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu JSON:', error);
    return "Impossible d'extraire le contenu du fichier JSON.";
  }
}

/**
 * Extrait le contenu d'un fichier DOCX
 */
async function extractDocxFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu DOCX avec mammoth');
    const mammoth = await import('mammoth');
    const arrayBuffer = await data.arrayBuffer();
    
    // Options avancées pour l'extraction du texte avec formatage
    const options = {
      arrayBuffer,
      convertImage: mammoth.images.imgElement((image: any) => {
        return {
          src: image.src
        };
      }),
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p => p:fresh",
        "table => table",
        "tr => tr",
        "td => td"
      ]
    };
    
    // Extraire le texte avec formatage HTML
    const result = await mammoth.convertToHtml(options);
    console.log('[DOCUMENT_EXTRACTION] Résultat de l\'extraction DOCX:', result.messages);
    
    // Si l'extraction HTML échoue, essayer d'extraire le texte brut
    if (!result.value || result.value.trim() === '') {
      console.log('[DOCUMENT_EXTRACTION] Extraction HTML échouée, tentative d\'extraction de texte brut');
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      const content = textResult.value || "Le document DOCX ne contient pas de texte extractible.";
      console.log('[DOCUMENT_EXTRACTION] Contenu texte brut extrait, longueur:', content.length);
      return content;
    }
    
    // Nettoyer le HTML pour le rendre plus lisible en texte
    const cleanedHtml = result.value
      .replace(/<h1>/g, '\n\n## ')
      .replace(/<\/h1>/g, '\n')
      .replace(/<h2>/g, '\n\n### ')
      .replace(/<\/h2>/g, '\n')
      .replace(/<h3>/g, '\n\n#### ')
      .replace(/<\/h3>/g, '\n')
      .replace(/<h4>/g, '\n\n##### ')
      .replace(/<\/h4>/g, '\n')
      .replace(/<p>/g, '\n')
      .replace(/<\/p>/g, '')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<li>/g, '\n- ')
      .replace(/<\/li>/g, '')
      .replace(/<ul>/g, '')
      .replace(/<\/ul>/g, '\n')
      .replace(/<ol>/g, '')
      .replace(/<\/ol>/g, '\n')
      .replace(/<table>/g, '\n\nTABLEAU:\n')
      .replace(/<\/table>/g, '\n')
      .replace(/<tr>/g, '')
      .replace(/<\/tr>/g, '\n')
      .replace(/<td>/g, ' | ')
      .replace(/<\/td>/g, '')
      .replace(/<th>/g, ' | ')
      .replace(/<\/th>/g, '')
      .replace(/<[^>]*>/g, '') // Supprimer les balises HTML restantes
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n') // Réduire les sauts de ligne multiples
      .trim();
    
    console.log('[DOCUMENT_EXTRACTION] Contenu HTML nettoyé, longueur:', cleanedHtml.length);
    return cleanedHtml;
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu DOCX:', error);
    return "Impossible d'extraire le contenu du document DOCX. Veuillez copier-coller le contenu manuellement.";
  }
}

/**
 * Extrait le contenu d'un fichier DOC (ancien format Word)
 */
async function extractDocFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Tentative d\'extraction de contenu DOC comme texte brut');
    // Essayer de lire le contenu comme texte brut (peut fonctionner pour certains fichiers DOC simples)
    const textContent = await data.text();
    
    // Vérifier si le contenu semble être du texte lisible
    const isReadableText = /[a-zA-Z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-]{50,}/g.test(textContent);
    
    if (isReadableText) {
      console.log('[DOCUMENT_EXTRACTION] Contenu DOC extrait comme texte brut, longueur:', textContent.length);
      return textContent;
    } else {
      console.log('[DOCUMENT_EXTRACTION] Le contenu DOC ne semble pas être du texte lisible');
      return "Le document est au format DOC (ancien format Word). Ce format est difficile à traiter directement. Pour de meilleurs résultats, veuillez enregistrer le document au format DOCX et le téléverser à nouveau, ou copier-coller le contenu pertinent.";
    }
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu DOC:', error);
    return "Le document est au format DOC (ancien format Word). Ce format nécessite une conversion préalable. Veuillez enregistrer le document au format DOCX et le téléverser à nouveau, ou copier-coller le contenu pertinent.";
  }
}

/**
 * Extrait le contenu d'un fichier PDF
 */
async function extractPdfFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu PDF avec pdf-parse');
    const pdfParse = await import('pdf-parse');
    const arrayBuffer = await data.arrayBuffer();
    
    // Options pour l'extraction du texte
    const options = {
      // Limiter le nombre de pages à traiter (0 = toutes les pages)
      max: 0,
      // Fonction personnalisée pour le rendu du texte
      pagerender: function(pageData: any) {
        // Extraire le texte de la page
        const renderOptions = {
          normalizeWhitespace: true,
          disableCombineTextItems: false
        };
        return pageData.getTextContent(renderOptions)
          .then(function(textContent: any) {
            let lastY: number | undefined, text = '';
            // Parcourir les éléments de texte
            for (const item of textContent.items) {
              // Ajouter un saut de ligne si la position Y change significativement
              if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 5) {
                text += '\n';
              }
              text += item.str + ' ';
              lastY = item.transform[5];
            }
            return text;
          });
      }
    };
    
    const result = await pdfParse.default(Buffer.from(arrayBuffer), options);
    
    // Nettoyer le texte extrait
    const cleanedText = result.text
      .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul espace
      .replace(/\n{3,}/g, '\n\n') // Réduire les sauts de ligne multiples
      .trim();
    
    console.log('[DOCUMENT_EXTRACTION] Contenu PDF extrait, longueur:', cleanedText.length);
    
    return cleanedText || "Le PDF ne contient pas de texte extractible.";
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu PDF:', error);
    return "Impossible d'extraire le contenu du PDF. Veuillez copier-coller le contenu manuellement.";
  }
}

/**
 * Extrait le contenu d'un fichier Excel
 */
async function extractExcelFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu Excel avec xlsx');
    const XLSX = await import('xlsx');
    const arrayBuffer = await data.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Extraire le texte de toutes les feuilles
    let content = '';
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      content += `\n--- Feuille: ${sheetName} ---\n`;
      
      // Déterminer la largeur maximale de chaque colonne
      const columnWidths: number[] = [];
      json.forEach((row: any) => {
        if (Array.isArray(row)) {
          row.forEach((cell, index) => {
            const cellStr = String(cell || '');
            columnWidths[index] = Math.max(columnWidths[index] || 0, cellStr.length);
          });
        }
      });
      
      // Formater les données en tableau texte
      json.forEach((row: any, rowIndex: number) => {
        if (Array.isArray(row) && row.length > 0) {
          // Ajouter une ligne de séparation pour l'en-tête
          if (rowIndex === 1) {
            let separator = '';
            columnWidths.forEach(width => {
              separator += '+' + '-'.repeat(width + 2);
            });
            separator += '+';
            content += separator + '\n';
          }
          
          let rowStr = '';
          row.forEach((cell, index) => {
            const cellStr = String(cell || '');
            const padding = columnWidths[index] - cellStr.length;
            rowStr += cellStr + ' '.repeat(padding + 1) + '\t';
          });
          content += rowStr + '\n';
        }
      });
    });
    
    console.log('[DOCUMENT_EXTRACTION] Contenu Excel extrait, longueur:', content.length);
    
    return content || "Le fichier Excel ne contient pas de données extractibles.";
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu Excel:', error);
    return "Impossible d'extraire le contenu du fichier Excel. Veuillez copier-coller le contenu manuellement.";
  }
}

/**
 * Message pour les présentations PowerPoint
 */
function extractPowerPointFile(): string {
  console.log('[DOCUMENT_EXTRACTION] Format PowerPoint non pris en charge pour l\'extraction automatique');
  return "Le document est une présentation PowerPoint. Ce format nécessite une conversion préalable. Veuillez extraire le contenu pertinent et le partager sous forme de texte.";
}

/**
 * Extrait le contenu d'un fichier CSV/TSV
 */
async function extractCsvFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu CSV/TSV comme texte brut');
    const textContent = await data.text();
    console.log('[DOCUMENT_EXTRACTION] Contenu CSV/TSV extrait, longueur:', textContent.length);
    
    return textContent || "Le fichier CSV ne contient pas de données extractibles.";
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu CSV:', error);
    return "Impossible d'extraire le contenu du fichier CSV. Veuillez copier-coller le contenu manuellement.";
  }
}

/**
 * Extrait le contenu d'un fichier HTML
 */
async function extractHtmlFile(data: Blob): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Extraction du contenu HTML');
    const htmlContent = await data.text();
    // Extraire le texte du HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || htmlContent;
    console.log('[DOCUMENT_EXTRACTION] Contenu HTML extrait, longueur:', textContent.length);
    
    return textContent;
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction du contenu HTML:', error);
    return "Impossible d'extraire le contenu du fichier HTML. Veuillez copier-coller le contenu manuellement.";
  }
}

/**
 * Essaie d'extraire le contenu d'un fichier de format inconnu
 */
async function extractGenericFile(data: Blob, fileExtension?: string): Promise<string> {
  try {
    console.log('[DOCUMENT_EXTRACTION] Tentative d\'extraction comme texte brut pour le format inconnu:', fileExtension);
    const content = await data.text();
    console.log('[DOCUMENT_EXTRACTION] Contenu extrait comme texte brut, longueur:', content.length);
    
    return content;
  } catch (error) {
    console.error('[DOCUMENT_EXTRACTION] Erreur lors de l\'extraction comme texte brut:', error);
    return `Le format du document (${fileExtension}) n'est pas pris en charge pour l'extraction de contenu. Veuillez copier-coller le contenu pertinent du document pour que je puisse l'analyser.`;
  }
}

/**
 * Prétraite le contenu d'un document avec l'IA pour améliorer sa qualité
 * @param content Le contenu brut du document
 * @param documentName Le nom du document pour le contexte
 * @returns Le contenu prétraité
 */
export async function preprocessDocumentWithAI(content: string, documentName: string): Promise<string> {
  // Si le contenu est vide ou trop court, le retourner tel quel
  if (!content || content.length < 100) {
    console.log('[NLP_PREPROCESSING] Contenu trop court pour prétraitement:', content.length);
    return content;
  }
  
  // Vérifier si la clé API est disponible
  if (!import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.warn('[NLP_PREPROCESSING] Clé API OpenAI non configurée. Retour du contenu original sans prétraitement.');
    return content;
  }
  
  try {
    console.log('[NLP_PREPROCESSING] Début du prétraitement NLP pour:', documentName);
    
    // Si le contenu est trop long, le tronquer pour respecter les limites de tokens
    const maxLength = 15000; // Environ 4000 tokens
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + "\n\n[Contenu tronqué pour le prétraitement...]"
      : content;
    
    // Créer un prompt pour le prétraitement
    const prompt = `
Tu es un expert en traitement de documents et en structuration de texte. 
Voici le contenu d'un document intitulé "${documentName}".
Ton objectif est d'améliorer la structure et la lisibilité de ce contenu.

Voici ce que tu dois faire:
1. Identifier et corriger les problèmes de formatage (espaces, sauts de ligne, caractères spéciaux)
2. Structurer le contenu en sections logiques avec des titres clairs
3. Identifier et mettre en évidence les informations clés
4. Préserver toutes les informations importantes du document original
5. Formater les listes et tableaux de manière cohérente
6. Ne pas ajouter de nouvelles informations qui ne sont pas dans le document original

Retourne uniquement le contenu amélioré, sans commentaires ni explications.

Contenu du document:
${truncatedContent}
`;

    console.log('[NLP_PREPROCESSING] Envoi de la requête à l\'API OpenAI');
    
    // Appeler l'API OpenAI pour prétraiter le document
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const processedContent = response.choices[0].message.content;
    
    // Si le contenu traité est vide ou significativement plus court, retourner l'original
    if (!processedContent || processedContent.length < content.length * 0.5) {
      console.warn('[NLP_PREPROCESSING] Le contenu prétraité est vide ou trop court, retour du contenu original');
      return content;
    }
    
    console.log('[NLP_PREPROCESSING] Prétraitement terminé, nouvelle longueur:', processedContent.length);
    return processedContent;
  } catch (error) {
    console.error('[NLP_PREPROCESSING] Erreur lors du prétraitement du document avec l\'IA:', error);
    // En cas d'erreur, retourner le contenu original
    return content;
  }
}

/**
 * Analyse sémantique du document pour extraire les entités, concepts et thèmes principaux
 * @param content Le contenu du document
 * @param documentName Le nom du document
 * @returns Un objet contenant les entités, concepts et thèmes extraits
 */
export async function analyzeDocumentSemantics(content: string, documentName: string): Promise<any> {
  // Si le contenu est vide ou trop court, retourner un objet vide
  if (!content || content.length < 200) {
    console.log('[NLP_SEMANTICS] Contenu trop court pour analyse sémantique:', content.length);
    return { entities: [], concepts: [], themes: [] };
  }
  
  // Vérifier si la clé API est disponible
  if (!import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.warn('[NLP_SEMANTICS] Clé API OpenAI non configurée. Impossible d\'effectuer l\'analyse sémantique.');
    return { entities: [], concepts: [], themes: [] };
  }
  
  try {
    console.log('[NLP_SEMANTICS] Début de l\'analyse sémantique pour:', documentName);
    
    // Si le contenu est trop long, le tronquer pour respecter les limites de tokens
    const maxLength = 15000; // Environ 4000 tokens
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + "\n\n[Contenu tronqué pour l'analyse...]"
      : content;
    
    // Créer un prompt pour l'analyse sémantique
    const prompt = `
Tu es un expert en analyse sémantique de texte spécialisé dans le domaine de la santé et sécurité au travail.
Voici le contenu d'un document intitulé "${documentName}".
Ton objectif est d'extraire les entités, concepts et thèmes principaux de ce document.

Analyse le texte et retourne un JSON structuré avec les éléments suivants:
1. entities: liste des entités importantes (personnes, organisations, lieux, dates, etc.)
2. concepts: liste des concepts clés abordés dans le document
3. themes: liste des thèmes principaux du document
4. keywords: liste des mots-clés pertinents pour l'indexation
5. summary: un résumé concis du document en 3-5 phrases

Chaque élément doit être accompagné d'un score de pertinence entre 0 et 1.
Format attendu:
{
  "entities": [{"text": "nom de l'entité", "type": "type d'entité", "relevance": 0.95}],
  "concepts": [{"text": "concept", "relevance": 0.8}],
  "themes": [{"text": "thème", "relevance": 0.75}],
  "keywords": [{"text": "mot-clé", "relevance": 0.9}],
  "summary": "Résumé concis du document."
}

Contenu du document:
${truncatedContent}
`;

    console.log('[NLP_SEMANTICS] Envoi de la requête à l\'API OpenAI');
    
    // Appeler l'API OpenAI pour analyser le document
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const analysisResult = response.choices[0].message.content;
    
    if (!analysisResult) {
      console.warn('[NLP_SEMANTICS] Aucun résultat d\'analyse obtenu');
      return { entities: [], concepts: [], themes: [] };
    }
    
    try {
      const parsedResult = JSON.parse(analysisResult);
      console.log('[NLP_SEMANTICS] Analyse sémantique terminée, entités:', parsedResult.entities?.length || 0, 
                  'concepts:', parsedResult.concepts?.length || 0, 
                  'thèmes:', parsedResult.themes?.length || 0);
      
      // Stocker les résultats d'analyse dans la base de données
      await storeDocumentAnalysis(documentName, parsedResult);
      
      return parsedResult;
    } catch (parseError) {
      console.error('[NLP_SEMANTICS] Erreur lors du parsing du résultat JSON:', parseError);
      return { entities: [], concepts: [], themes: [] };
    }
  } catch (error) {
    console.error('[NLP_SEMANTICS] Erreur lors de l\'analyse sémantique du document:', error);
    return { entities: [], concepts: [], themes: [] };
  }
}

/**
 * Stocke les résultats d'analyse sémantique dans la base de données
 * @param documentName Le nom du document
 * @param analysis Les résultats de l'analyse
 */
async function storeDocumentAnalysis(documentName: string, analysis: any): Promise<void> {
  try {
    console.log('[NLP_STORAGE] Stockage de l\'analyse sémantique pour:', documentName);
    
    // Vérifier si une table d'analyse existe, sinon la créer
    // Note: Cette approche est simplifiée, idéalement il faudrait créer la table via une migration
    const { error: tableError } = await supabase.rpc('create_document_analysis_table_if_not_exists');
    
    if (tableError) {
      console.error('[NLP_STORAGE] Erreur lors de la vérification/création de la table d\'analyse:', tableError);
      return;
    }
    
    // Stocker l'analyse
    const { error: insertError } = await supabase
      .from('document_analysis')
      .insert({
        document_name: documentName,
        analysis_data: analysis,
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('[NLP_STORAGE] Erreur lors du stockage de l\'analyse sémantique:', insertError);
    } else {
      console.log('[NLP_STORAGE] Analyse sémantique stockée avec succès');
    }
  } catch (error) {
    console.error('[NLP_STORAGE] Erreur lors du stockage de l\'analyse sémantique:', error);
  }
}

/**
 * Stocke le contenu d'un document dans la base de données
 * @param documentId L'ID du document
 * @param content Le contenu du document
 * @param status Le statut de l'extraction
 */
async function storeDocumentContent(documentId: string, content: string, status: 'pending' | 'processing' | 'success' | 'failed' | 'partial' | 'manual'): Promise<void> {
  try {
    console.log('[DOCUMENT_STORAGE] Début du stockage pour le document ID:', documentId, 'statut:', status);
    
    // Si le contenu est trop long, le tronquer
    const maxContentLength = 100000; // Limiter à 100K caractères
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + "\n\n[Contenu tronqué en raison de sa longueur...]"
      : content;
    
    // Vérifier si un enregistrement existe déjà
    const { data: existingContent, error: checkError } = await supabase
      .from('document_contents')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();
    
    if (checkError) {
      console.error('[DOCUMENT_STORAGE] Erreur lors de la vérification du contenu existant:', checkError);
      return;
    }
    
    if (existingContent) {
      console.log('[DOCUMENT_STORAGE] Contenu existant trouvé, mise à jour');
      // Mettre à jour l'enregistrement existant
      const { error: updateError } = await supabase
        .from('document_contents')
        .update({
          content: truncatedContent,
          extraction_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);
      
      if (updateError) {
        console.error('[DOCUMENT_STORAGE] Erreur lors de la mise à jour du contenu du document:', updateError);
      } else {
        console.log('[DOCUMENT_STORAGE] Contenu du document mis à jour avec succès');
      }
    } else {
      console.log('[DOCUMENT_STORAGE] Aucun contenu existant, création d\'un nouvel enregistrement');
      // Créer un nouvel enregistrement
      const { error: insertError } = await supabase
        .from('document_contents')
        .insert({
          document_id: documentId,
          content: truncatedContent,
          extraction_status: status
        });
      
      if (insertError) {
        console.error('[DOCUMENT_STORAGE] Erreur lors du stockage du contenu du document:', insertError);
      } else {
        console.log('[DOCUMENT_STORAGE] Contenu du document stocké avec succès');
      }
    }
  } catch (error) {
    console.error('[DOCUMENT_STORAGE] Erreur lors du stockage du contenu du document:', error);
  }
}

/**
 * Récupère un document par son ID
 * @param documentId L'ID du document à récupérer
 * @returns Le document ou null si non trouvé
 */
export async function getDocumentById(documentId: string): Promise<Document | null> {
  try {
    console.log('[DOCUMENT_RETRIEVAL] Récupération du document par ID:', documentId);
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (error) {
      console.error('[DOCUMENT_RETRIEVAL] Erreur lors de la récupération du document:', error);
      return null;
    }
    
    console.log('[DOCUMENT_RETRIEVAL] Document récupéré avec succès');
    return data;
  } catch (error) {
    console.error('[DOCUMENT_RETRIEVAL] Erreur lors de la récupération du document:', error);
    return null;
  }
}

/**
 * Récupère le contenu prétraité d'un document
 * @param documentId L'ID du document
 * @returns Le contenu du document ou null si non trouvé
 */
export async function getDocumentContent(documentId: string): Promise<string | null> {
  try {
    console.log('[DOCUMENT_RETRIEVAL] Récupération du contenu pour le document ID:', documentId);
    
    // Utiliser select() au lieu de single() pour éviter l'erreur quand aucun résultat n'est trouvé
    const { data, error } = await supabase
      .from('document_contents')
      .select('content, extraction_status')
      .eq('document_id', documentId);
    
    if (error) {
      console.error('[DOCUMENT_RETRIEVAL] Erreur lors de la récupération du contenu du document:', error);
      return null;
    }
    
    // Vérifier si des données ont été retournées
    if (!data || data.length === 0) {
      console.log('[DOCUMENT_RETRIEVAL] Aucun contenu trouvé pour le document:', documentId);
      return null;
    }
    
    console.log('[DOCUMENT_RETRIEVAL] Contenu récupéré avec succès, statut:', data[0].extraction_status);
    // Retourner le contenu du premier enregistrement trouvé
    return data[0].content;
  } catch (error) {
    console.error('[DOCUMENT_RETRIEVAL] Erreur lors de la récupération du contenu du document:', error);
    return null;
  }
}

/**
 * Détermine si un document est supporté pour l'extraction de contenu
 * @param document Le document à vérifier
 * @returns Un objet indiquant si le document est supporté et un message explicatif
 */
export function isDocumentSupported(document: Document): { supported: boolean; message: string } {
  const fileExtension = document.name.split('.').pop()?.toLowerCase();
  
  const supportedExtensions = ['txt', 'json', 'docx', 'pdf', 'xlsx', 'xls', 'csv', 'tsv', 'html', 'htm', 'mp3', 'wav', 'ogg', 'm4a'];
  const partialSupportExtensions = ['doc', 'ppt', 'pptx'];
  
  if (supportedExtensions.includes(fileExtension || '')) {
    return { 
      supported: true, 
      message: "Ce document est entièrement pris en charge pour l'extraction de contenu." 
    };
  } else if (partialSupportExtensions.includes(fileExtension || '')) {
    return { 
      supported: true, 
      message: "Ce document est partiellement pris en charge. L'extraction de contenu peut être limitée." 
    };
  } else {
    return { 
      supported: false, 
      message: `Le format de fichier ${fileExtension} n'est pas pris en charge pour l'extraction automatique de contenu.` 
    };
  }
}

/**
 * Traite un document après son téléversement pour extraire et stocker son contenu
 * @param document Le document à traiter
 * @returns Un booléen indiquant si le traitement a réussi
 */
export async function processUploadedDocument(document: Document): Promise<boolean> {
  try {
    console.log('[DOCUMENT_PROCESSING] Traitement du document après téléversement:', document.name, 'ID:', document.id);
    
    // Vérifier si c'est un fichier audio
    const fileExtension = document.name.split('.').pop()?.toLowerCase();
    const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '');
    
    if (isAudioFile) {
      console.log('[DOCUMENT_PROCESSING] Fichier audio détecté, lancement de la transcription');
      
      // Stocker un message temporaire pendant la transcription
      await storeDocumentContent(
        document.id,
        "Pour les fichiers audio, une transcription est en cours. Veuillez patienter...",
        'processing'
      );
      
      // Lancer la transcription
      try {
        const transcription = await transcribeAudio(document.url);
        
        // Stocker la transcription dans la base de données
        await storeDocumentContent(document.id, transcription, 'success');
        console.log('[DOCUMENT_PROCESSING] Transcription audio terminée et stockée avec succès');
        
        return true;
      } catch (transcriptionError) {
        console.error('[DOCUMENT_PROCESSING] Erreur lors de la transcription audio:', transcriptionError);
        
        // Stocker un message d'erreur
        await storeDocumentContent(
          document.id,
          "Ce document est un fichier audio. La transcription automatique a échoué. Veuillez saisir manuellement la transcription.",
          'failed'
        );
        
        return false;
      }
    }
    
    // Extraire le contenu du document
    console.log('[DOCUMENT_PROCESSING] Début de l\'extraction du contenu');
    let content = await extractDocumentContent(document);
    console.log('[DOCUMENT_PROCESSING] Extraction terminée, longueur du contenu:', content.length);
    
    // Prétraiter le contenu avec l'IA si possible
    if (content && !content.includes("Impossible d'extraire") && !content.includes("n'est pas pris en charge")) {
      try {
        console.log('[DOCUMENT_PROCESSING] Début du prétraitement NLP');
        const processedContent = await preprocessDocumentWithAI(content, document.name);
        
        if (processedContent && processedContent.length > 0) {
          console.log('[DOCUMENT_PROCESSING] Prétraitement NLP terminé, nouvelle longueur:', processedContent.length);
          // Mettre à jour le contenu dans la base de données avec la version prétraitée
          await storeDocumentContent(document.id, processedContent, 'success');
          console.log('[DOCUMENT_PROCESSING] Contenu prétraité stocké avec succès');
          
          // Effectuer une analyse sémantique du document
          console.log('[DOCUMENT_PROCESSING] Début de l\'analyse sémantique');
          await analyzeDocumentSemantics(processedContent, document.name);
          console.log('[DOCUMENT_PROCESSING] Analyse sémantique terminée');
        } else {
          console.log('[DOCUMENT_PROCESSING] Prétraitement NLP n\'a pas produit de résultat valide');
        }
      } catch (aiError) {
        console.error('[DOCUMENT_PROCESSING] Erreur lors du prétraitement avec l\'IA, utilisation du contenu brut:', aiError);
        // Le contenu brut est déjà stocké par extractDocumentContent
      }
    } else {
      console.log('[DOCUMENT_PROCESSING] Le contenu extrait n\'est pas valide pour le prétraitement NLP');
    }
    
    console.log('[DOCUMENT_PROCESSING] Traitement du document terminé avec succès:', document.name);
    return true;
  } catch (error) {
    console.error('[DOCUMENT_PROCESSING] Erreur lors du traitement du document:', error);
    
    // Enregistrer l'échec dans la base de données
    try {
      await storeDocumentContent(
        document.id,
        "Erreur lors de l'extraction du contenu.",
        'failed'
      );
    } catch (dbError) {
      console.error('[DOCUMENT_PROCESSING] Erreur lors de l\'enregistrement de l\'échec d\'extraction:', dbError);
    }
    
    return false;
  }
}

/**
 * Génère un vecteur d'embedding pour le contenu d'un document
 * @param content Le contenu du document
 * @returns Un vecteur d'embedding ou null en cas d'erreur
 */
export async function generateDocumentEmbedding(content: string): Promise<number[] | null> {
  // Si le contenu est vide ou trop court, retourner null
  if (!content || content.length < 100) {
    console.log('[EMBEDDING] Contenu trop court pour générer un embedding:', content.length);
    return null;
  }
  
  // Vérifier si la clé API est disponible
  if (!import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.warn('[EMBEDDING] Clé API OpenAI non configurée. Impossible de générer un embedding.');
    return null;
  }
  
  try {
    console.log('[EMBEDDING] Génération d\'embedding pour un contenu de longueur:', content.length);
    
    // Si le contenu est trop long, le tronquer
    const maxLength = 8000; // Limite pour l'API d'embedding
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength)
      : content;
    
    // Appeler l'API OpenAI pour générer l'embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedContent,
      encoding_format: "float"
    });
    
    if (response.data && response.data.length > 0) {
      console.log('[EMBEDDING] Embedding généré avec succès, dimensions:', response.data[0].embedding.length);
      return response.data[0].embedding;
    } else {
      console.error('[EMBEDDING] Aucun embedding retourné par l\'API');
      return null;
    }
  } catch (error) {
    console.error('[EMBEDDING] Erreur lors de la génération de l\'embedding:', error);
    return null;
  }
}

/**
 * Transcrit un fichier audio en utilisant l'API Whisper d'OpenAI
 * @param audioUrl URL du fichier audio à transcrire
 * @returns Le tex te transcrit
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  try {
    console.log('[AUDIO_TRANSCRIPTION] Début de la transcription pour:', audioUrl);
    
    // Essayer d'abord la transcription côté serveur
    try {
      console.log('[AUDIO_TRANSCRIPTION] Tentative de transcription côté serveur');
      
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ audioUrl })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AUDIO_TRANSCRIPTION] Erreur lors de la transcription côté serveur:', errorData);
        throw new Error(errorData.message || 'Erreur lors de la transcription côté serveur');
      }
      
      const result = await response.json();
      
      if (result.success && result.transcription) {
        console.log('[AUDIO_TRANSCRIPTION] Transcription côté serveur réussie');
        return result.transcription;
      }
      
      throw new Error('Aucune transcription retournée par le serveur');
      
    } catch (serverError) {
      console.warn('[AUDIO_TRANSCRIPTION] Échec de la transcription côté serveur, tentative côté client:', serverError);
      
      // Si la transcription côté serveur échoue, essayer côté client
      try {
        console.log('[AUDIO_TRANSCRIPTION] Téléchargement du fichier audio côté client');
        
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          throw new Error("Erreur HTTP: " + audioResponse.status);
        }
        
        const audioBlob = await audioResponse.blob();
        console.log('[AUDIO_TRANSCRIPTION] Fichier audio téléchargé, taille:', audioBlob.size);
        
        // Vérifier la taille du fichier
        const maxSizeInBytes = 25 * 1024 * 1024; // 25 MB
        if (audioBlob.size > maxSizeInBytes) {
          return "Ce fichier audio est trop volumineux pour être transcrit automatiquement (limite de 25 Mo). Veuillez saisir manuellement la transcription.";
        }
        
        // Créer un FormData pour l'envoi à l'API
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.mp3');
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr'); // Langue française
        
        console.log('[AUDIO_TRANSCRIPTION] Envoi à l\'API OpenAI pour transcription');
        
        // Appeler l'API OpenAI pour la transcription
        const openaiClient = new OpenAI({
          apiKey: import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai-api-key') || 'dummy-key',
          dangerouslyAllowBrowser: true
        });
        
        const transcriptionResponse = await openaiClient.audio.transcriptions.create({
          file: new File([audioBlob], 'audio.mp3', { type: audioBlob.type }),
          model: 'whisper-1',
          language: 'fr'
        });
        
        console.log('[AUDIO_TRANSCRIPTION] Transcription côté client réussie');
        return transcriptionResponse.text;
        
      } catch (clientError) {
        console.error('[AUDIO_TRANSCRIPTION] Échec de la transcription côté client:', clientError);
        return "Ce document est un fichier audio. La transcription automatique a échoué. Veuillez saisir manuellement la transcription.";
      }
    }
    
  } catch (error) {
    console.error('[AUDIO_TRANSCRIPTION] Erreur lors de la transcription audio:', error);
    return "Ce document est un fichier audio. Une erreur s'est produite lors de la tentative de transcription. Veuillez saisir manuellement la transcription.";
  }
}