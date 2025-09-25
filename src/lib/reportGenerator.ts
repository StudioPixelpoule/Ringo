import { ConversationDocument } from './conversationStore';
import { supabase } from './supabase';
import { generateChatResponseSecure } from './secureChat';

interface ReportTemplate {
  id: string;
  name: string;
  type: 'summary' | 'analysis' | 'comparison' | 'extraction';
  prompt: string;
}

// Helper function pour formater les JSON de commentaires
function formatCommentsJson(data: any, fileName: string): string {
  try {
    let result = `
=== Document: ${fileName} ===
Type: Commentaires structurés

`;
    
    // Si c'est un tableau de commentaires
    if (Array.isArray(data)) {
      result += `Nombre de commentaires: ${data.length}\n\n`;
      data.forEach((comment, index) => {
        if (typeof comment === 'object') {
          result += `Commentaire ${index + 1}:\n`;
          Object.entries(comment).forEach(([key, value]) => {
            if (value && value !== '') {
              result += `  - ${key}: ${JSON.stringify(value, null, 2)}\n`;
            }
          });
          result += '\n';
        } else {
          result += `Commentaire ${index + 1}: ${comment}\n\n`;
        }
      });
    } 
    // Si c'est un objet avec des sections
    else if (typeof data === 'object') {
      Object.entries(data).forEach(([section, content]) => {
        result += `\n### ${section}\n`;
        if (Array.isArray(content)) {
          content.forEach((item: any, idx: number) => {
            if (typeof item === 'object') {
              result += `\n${idx + 1}. `;
              Object.entries(item).forEach(([k, v]) => {
                if (v) result += `${k}: ${v}; `;
              });
            } else {
              result += `\n${idx + 1}. ${item}`;
            }
          });
        } else if (typeof content === 'object') {
          result += JSON.stringify(content, null, 2);
        } else {
          result += content;
        }
        result += '\n';
      });
    }
    
    result += '\n=== Fin du document ===';
    return result;
  } catch (error) {
    console.error('Error formatting comments JSON:', error);
    return `
=== Document: ${fileName} ===

${JSON.stringify(data, null, 2)}

=== Fin du document ===
`;
  }
}

// Helper function pour formater les objets JSON
function formatObjectJson(data: any, fileName: string): string {
  try {
    let result = `
=== Document: ${fileName} ===
Type: Données structurées

`;
    
    // Extraire les champs importants
    const keys = Object.keys(data);
    result += `Nombre de champs: ${keys.length}\n\n`;
    
    // Afficher les données de manière structurée
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return; // Skip empty values
      }
      
      result += `### ${key}\n`;
      
      if (Array.isArray(value)) {
        result += `(Liste de ${value.length} éléments)\n`;
        if (value.length <= 10) {
          value.forEach((item, idx) => {
            if (typeof item === 'object') {
              result += `${idx + 1}. ${JSON.stringify(item, null, 2)}\n`;
            } else {
              result += `${idx + 1}. ${item}\n`;
            }
          });
        } else {
          // Si trop d'éléments, afficher les premiers et les derniers
          result += 'Premiers éléments:\n';
          value.slice(0, 5).forEach((item, idx) => {
            result += `${idx + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
          });
          result += `\n... (${value.length - 10} autres éléments) ...\n\n`;
          result += 'Derniers éléments:\n';
          value.slice(-5).forEach((item, idx) => {
            result += `${value.length - 4 + idx}. ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
          });
        }
      } else if (typeof value === 'object') {
        result += JSON.stringify(value, null, 2) + '\n';
      } else {
        result += `${value}\n`;
      }
      
      result += '\n';
    });
    
    result += '=== Fin du document ===';
    return result;
  } catch (error) {
    console.error('Error formatting object JSON:', error);
    return `
=== Document: ${fileName} ===

${JSON.stringify(data, null, 2)}

=== Fin du document ===
`;
  }
}

async function getDocumentContent(doc: ConversationDocument): Promise<string> {
  try {
    // Vérifier que l'objet documents existe
    if (!doc.documents) {
      console.error(`[ReportGenerator] No documents object found in ConversationDocument`);
      throw new Error(`Document object missing`);
    }
    
    const documentId = doc.document_id;  // Utiliser document_id de la relation
    const documentName = doc.documents.name;
    const isProcessed = doc.documents.processed;
    
    console.log(`[ReportGenerator] Fetching content for: ${documentName}`);
    console.log(`[ReportGenerator] - document_id from relation: ${documentId}`);
    console.log(`[ReportGenerator] - documents.id: ${doc.documents.id}`);
    console.log(`[ReportGenerator] - processed: ${isProcessed}`);
    
    // Essayer d'abord de récupérer le contenu depuis document_contents
    const { data: contentData, error: contentError } = await supabase
      .from('document_contents')
      .select('content')
      .eq('document_id', documentId)
      .maybeSingle();

    if (contentError && contentError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error(`[ReportGenerator] Error fetching from document_contents:`, contentError);
    }

    let data = contentData;
    
    // Si pas trouvé avec document_id, essayer avec documents.id
    if (!data?.content && doc.documents.id !== documentId) {
      console.log(`[ReportGenerator] Trying with documents.id: ${doc.documents.id}`);
      const { data: altData, error: altError } = await supabase
        .from('document_contents')
        .select('content')
        .eq('document_id', doc.documents.id)
        .maybeSingle();
      
      if (altError && altError.code !== 'PGRST116') {
        console.error(`[ReportGenerator] Error with alternate ID:`, altError);
      }
      
      if (altData?.content) {
        console.log(`[ReportGenerator] Found content with documents.id`);
        data = altData;
      }
    }
    
    // Ajouter plus de debugging
    if (!data?.content) {
      console.log(`[ReportGenerator] No content found after all attempts`);
      console.log(`[ReportGenerator] Document details:`, {
        name: doc.documents.name,
        type: doc.documents.type,
        url: doc.documents.url,
        processed: doc.documents.processed,
        document_id: documentId,
        documents_id: doc.documents.id
      });
    }
    
    if (data?.content) {
      console.log(`[ReportGenerator] Content found, length: ${data.content?.length || 0}`);
      
      // Vérifier si le contenu n'est pas vide ou juste des espaces
      const contentStr = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      if (!contentStr || contentStr.trim().length === 0) {
        console.warn(`[ReportGenerator] Content is empty for ${documentName}`);
        return `[Document: ${documentName}]\n\nCe document ne contient aucune donnée exploitable. Il semble être vide ou mal formaté.\n\nPour résoudre ce problème, veuillez vérifier le contenu du document original et l'importer à nouveau si nécessaire.`;
      }
    } else {
      console.log(`[ReportGenerator] No content found for document ${documentName}`);
    }

    if (!data?.content) {
      console.error(`[ReportGenerator] Failed to find content. Tried:`);
      console.error(`- document_id: ${documentId}`);
      console.error(`- documents.id: ${doc.documents.id}`);
      
      // Utiliser un contenu de fallback pour ne pas bloquer la génération
      console.warn(`[ReportGenerator] Using fallback content for ${documentName}`);
      return `[Document: ${documentName}]\n\nLe contenu de ce document n'a pas pu être récupéré. Le document existe mais son contenu n'est pas accessible pour la génération de rapport.\n\nPour résoudre ce problème, veuillez retirer ce document de la conversation et l'importer à nouveau.`;
    }

    // Parse content based on document type
    if (doc.documents.type === 'audio') {
      // For audio files, extract transcription from JSON
      try {
        const audioData = JSON.parse(data.content);
        return `
=== Transcription Audio ===
Fichier: ${audioData.metadata.fileName}
Durée: ${Math.floor(audioData.metadata.duration / 60)}:${String(Math.floor(audioData.metadata.duration % 60)).padStart(2, '0')}
Langue: ${audioData.metadata.language === 'fra' ? 'Français' : 'Anglais'}

${audioData.content}
`;
      } catch (e) {
        console.error('Error parsing audio content:', e);
        return data.content;
      }
    } else if (doc.documents.type === 'data' || doc.documents.type === 'json' || doc.documents.name?.endsWith('.json')) {
      // For data files (JSON, CSV, etc.), format the content
      try {
        console.log(`[ReportGenerator] Processing JSON/data file: ${doc.documents.name}`);
        
        // Le contenu peut être déjà un objet ou une string JSON
        let parsedContent;
        if (typeof data.content === 'string') {
          try {
            parsedContent = JSON.parse(data.content);
          } catch {
            // Si ce n'est pas du JSON valide, utiliser tel quel
            console.log(`[ReportGenerator] Content is not valid JSON, using as-is`);
            return `
=== Document: ${doc.documents.name} ===

${data.content}

=== Fin du document ===
`;
          }
        } else {
          parsedContent = data.content;
        }
        
        // Vérifier si c'est un format spécifique avec metadata
        if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
          const formattedContent = `
=== Document: ${doc.documents.name} ===
Type: ${parsedContent.type || 'Données structurées'}

Contenu:
${JSON.stringify(parsedContent.data, null, 2)}

=== Fin du document ===
`;
          console.log(`[ReportGenerator] Formatted structured data, length: ${formattedContent.length}`);
          return formattedContent;
        } 
        
        // Analyser le contenu pour extraire les informations pertinentes
        let formattedContent = '';
        
        // Si le JSON contient des commentaires ou du texte structuré
        if (doc.documents.name.includes('comments') || doc.documents.name.includes('commentaires')) {
          formattedContent = formatCommentsJson(parsedContent, doc.documents.name);
        } else if (Array.isArray(parsedContent)) {
          // Si c'est un tableau, formater chaque élément
          formattedContent = `
=== Document: ${doc.documents.name} ===
Type: Données JSON (Liste de ${parsedContent.length} éléments)

Contenu:
${parsedContent.map((item, index) => {
  if (typeof item === 'object') {
    return `\nÉlément ${index + 1}:\n${JSON.stringify(item, null, 2)}`;
  }
  return `\nÉlément ${index + 1}: ${item}`;
}).join('\n')}

=== Fin du document ===
`;
        } else if (typeof parsedContent === 'object') {
          // Pour un objet, essayer d'extraire les champs importants
          formattedContent = formatObjectJson(parsedContent, doc.documents.name);
        } else {
          // Format par défaut
          formattedContent = `
=== Document: ${doc.documents.name} ===
Type: Données JSON

Contenu:
${JSON.stringify(parsedContent, null, 2)}

=== Fin du document ===
`;
        }
        
        console.log(`[ReportGenerator] Formatted JSON content, length: ${formattedContent.length}`);
        return formattedContent;
        
      } catch (error) {
        console.error(`[ReportGenerator] Error processing JSON/data content:`, error);
        return `
=== Document: ${doc.documents.name} ===

${data.content}

=== Fin du document ===
`;
      }
    } else if (doc.documents.type === 'csv' || doc.documents.name?.endsWith('.csv')) {
      // For CSV files, format as table
      try {
        console.log(`[ReportGenerator] Processing CSV file: ${doc.documents.name}`);
        
        let parsedContent;
        if (typeof data.content === 'string') {
          try {
            parsedContent = JSON.parse(data.content);
          } catch {
            // Si ce n'est pas du JSON, c'est peut-être du CSV brut
            return `
=== Document CSV: ${doc.documents.name} ===

${data.content}

=== Fin du document ===
`;
          }
        } else {
          parsedContent = data.content;
        }
        
        if (parsedContent && parsedContent.data) {
          return `
=== Document CSV: ${doc.documents.name} ===
Type: Données tabulaires
${parsedContent.metadata ? `Nombre de lignes: ${parsedContent.metadata.rowCount}` : ''}

Données:
${JSON.stringify(parsedContent.data, null, 2)}

=== Fin du document ===
`;
        }
        
        return `
=== Document CSV: ${doc.documents.name} ===

${JSON.stringify(parsedContent, null, 2)}

=== Fin du document ===
`;
        
      } catch (error) {
        console.error(`[ReportGenerator] Error processing CSV content:`, error);
        return data.content;
      }
    } else {
      // For text documents, return content directly
      console.log(`[ReportGenerator] Processing text document: ${doc.documents.name}, type: ${doc.documents.type}`);
      return data.content;
    }
  } catch (error) {
    console.error('Error fetching document content:', error);
    throw error;
  }
}

export async function generateReport(
  documents: ConversationDocument[],
  template: ReportTemplate,
  signal?: AbortSignal
): Promise<string> {
  try {
    if (!documents.length) {
      throw new Error('Aucun document disponible pour analyse');
    }

    // Fetch content for all documents
    const contents = await Promise.all(
      documents.map(async doc => {
        if (signal?.aborted) {
          throw new Error('Génération annulée');
        }

        const content = await getDocumentContent(doc);
        return {
          name: doc.documents.name,
          type: doc.documents.type,
          content
        };
      })
    );

    // Create system message with template instructions
    const systemMessage = `Tu es un expert en analyse de documents spécialisé dans la génération de rapports.

OBJECTIF : ${template.prompt}

INSTRUCTIONS IMPORTANTES :
1. Utilise UNIQUEMENT le contenu des documents fournis
2. Suis strictement la structure demandée
3. Reste factuel et objectif
4. Cite des passages pertinents des documents
5. Utilise le format Markdown pour la mise en forme

FORMAT :
- Titres principaux avec ##
- Sous-titres avec ###
- Points importants en **gras**
- Citations en > blockquote
- Listes à puces avec -

DOCUMENTS À ANALYSER :
${contents.map((doc, i) => `${i + 1}. ${doc.name} (${doc.type})`).join('\n')}

CONTEXTE : Ces documents font partie d'une même conversation et doivent être analysés ensemble.`;

    // Format document content with clear separation
    const formattedContent = contents.map(doc => {
      // Pour les documents JSON volumineux, optimiser le format
      let processedContent = doc.content;
      
      // Vérifier si le contenu est trop long et le tronquer si nécessaire
      const MAX_CONTENT_LENGTH = 50000; // Limite de caractères par document
      
      if (processedContent.length > MAX_CONTENT_LENGTH) {
        console.warn(`[ReportGenerator] Content for ${doc.name} is too long (${processedContent.length} chars), truncating...`);
        processedContent = processedContent.substring(0, MAX_CONTENT_LENGTH) + `\n\n[... Contenu tronqué pour l'analyse. Document original : ${processedContent.length} caractères ...]`;
      }
      
      return `
====== DÉBUT DU DOCUMENT: ${doc.name} (${doc.type}) ======

${processedContent}

====== FIN DU DOCUMENT: ${doc.name} ======
`;
    }).join('\n\n---\n\n');

    // Generate report content using OpenAI
    const reportContent = await generateChatResponseSecure(
      [
        { role: 'system', content: systemMessage },
        { 
          role: 'user', 
          content: `Génère un rapport en suivant les instructions ci-dessus. Voici le contenu des documents à analyser :\n\n${formattedContent}` 
        }
      ],
      formattedContent
    );

    return reportContent;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}