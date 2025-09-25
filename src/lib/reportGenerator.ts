import { ConversationDocument } from './conversationStore';
import { supabase } from './supabase';
import { generateChatResponseSecure } from './secureChat';

interface ReportTemplate {
  id: string;
  name: string;
  type: 'summary' | 'analysis' | 'comparison' | 'extraction';
  prompt: string;
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
      console.log(`[ReportGenerator] Content found, length: ${data.content.length}`);
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
    } else if (doc.documents.type === 'data') {
      // For data files (JSON, CSV, etc.), format the content
      try {
        const dataContent = JSON.parse(data.content);
        return `
=== Données Structurées ===
Type: ${dataContent.type}
Fichier: ${dataContent.fileName}

${JSON.stringify(dataContent.data, null, 2)}
`;
      } catch {
        return data.content;
      }
    } else {
      // For text documents, return content directly
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
    const formattedContent = contents.map(doc => `
====== DÉBUT DU DOCUMENT: ${doc.name} (${doc.type}) ======

${doc.content}

====== FIN DU DOCUMENT: ${doc.name} ======
`).join('\n\n---\n\n');

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