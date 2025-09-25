import { supabase } from './supabase';

/**
 * Migre le contenu d'un document depuis la table documents vers document_contents
 * si nécessaire
 */
export async function migrateDocumentContent(documentId: string): Promise<boolean> {
  try {
    console.log(`[Migration] Checking if document ${documentId} needs content migration...`);
    
    // Vérifier si le contenu existe déjà dans document_contents
    const { data: existingContent, error: checkError } = await supabase
      .from('document_contents')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();
    
    if (existingContent) {
      console.log(`[Migration] Document ${documentId} already has content in document_contents`);
      return false; // Pas besoin de migrer
    }
    
    // Récupérer le contenu depuis la table documents
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('content, processed')
      .eq('id', documentId)
      .maybeSingle();
    
    if (docError) {
      console.error(`[Migration] Error fetching document:`, docError);
      return false;
    }
    
    if (!docData?.content) {
      console.log(`[Migration] Document ${documentId} has no content to migrate`);
      return false;
    }
    
    // Migrer le contenu vers document_contents
    console.log(`[Migration] Migrating content for document ${documentId}...`);
    
    const { error: insertError } = await supabase
      .from('document_contents')
      .insert([{
        document_id: documentId,
        content: docData.content,
        is_chunked: false,
        chunk_index: 0,
        total_chunks: 1
      }]);
    
    if (insertError) {
      console.error(`[Migration] Error inserting content:`, insertError);
      return false;
    }
    
    console.log(`[Migration] Successfully migrated content for document ${documentId}`);
    
    // Optionnel : marquer le document comme traité si ce n'est pas déjà fait
    if (!docData.processed) {
      await supabase
        .from('documents')
        .update({ processed: true })
        .eq('id', documentId);
    }
    
    return true;
  } catch (error) {
    console.error(`[Migration] Unexpected error:`, error);
    return false;
  }
}

/**
 * Migre le contenu de tous les documents d'une conversation
 */
export async function migrateConversationDocuments(conversationId: string): Promise<void> {
  try {
    console.log(`[Migration] Starting migration for conversation ${conversationId}...`);
    
    // Récupérer tous les documents de la conversation
    const { data: conversationDocs, error } = await supabase
      .from('conversation_documents')
      .select('document_id')
      .eq('conversation_id', conversationId);
    
    if (error) {
      console.error(`[Migration] Error fetching conversation documents:`, error);
      return;
    }
    
    if (!conversationDocs || conversationDocs.length === 0) {
      console.log(`[Migration] No documents found for conversation ${conversationId}`);
      return;
    }
    
    console.log(`[Migration] Found ${conversationDocs.length} documents to check`);
    
    // Migrer chaque document si nécessaire
    let migratedCount = 0;
    for (const doc of conversationDocs) {
      const migrated = await migrateDocumentContent(doc.document_id);
      if (migrated) {
        migratedCount++;
      }
    }
    
    console.log(`[Migration] Migration complete. Migrated ${migratedCount} documents`);
  } catch (error) {
    console.error(`[Migration] Unexpected error during conversation migration:`, error);
  }
}
