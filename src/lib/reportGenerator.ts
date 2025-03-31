import { ConversationDocument } from './conversationStore';
import { supabase } from './supabase';
import { generateChatResponse } from './openai';

interface ReportTemplate {
  id: string;
  name: string;
  type: 'summary' | 'analysis' | 'comparison' | 'extraction';
  prompt: string;
}

async function getDocumentContent(doc: ConversationDocument): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('document_contents')
      .select('content, is_chunked, chunk_index, total_chunks')
      .eq('document_id', doc.document_id)
      .order('chunk_index', { ascending: true })
      .maybeSingle();

    if (error) throw error;
    if (!data?.content) {
      throw new Error(`No content found for document: ${doc.documents.name}`);
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
    const reportContent = await generateChatResponse(
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