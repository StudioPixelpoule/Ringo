import { supabase } from './supabase';
import { ProcessingResult } from './documentProcessor';

// Fonction pour calculer le hash d'un fichier
async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Interface pour le cache
export interface CacheEntry {
  content: string;
  file_name: string;
  file_type: string;
  file_size: number;
  cached_at: string;
}

// Service de cache
export class DocumentCache {
  // Vérifie si un document est en cache
  async has(file: File): Promise<boolean> {
    try {
      const hash = await computeHash(file);
      const { data } = await supabase
        .from('document_cache')
        .select('hash')
        .eq('hash', hash)
        .single();
      
      return !!data;
    } catch (error) {
      console.warn('Cache check failed:', error);
      return false;
    }
  }

  // Récupère un document du cache
  async get(file: File): Promise<ProcessingResult | null> {
    try {
      const hash = await computeHash(file);
      const { data, error } = await supabase
        .from('document_cache')
        .select('*')
        .eq('hash', hash)
        .single();

      if (error || !data) {
        return null;
      }

      // Vérifier que le fichier correspond
      if (
        data.file_name !== file.name ||
        data.file_type !== file.type ||
        data.file_size !== file.size
      ) {
        console.warn('Cache entry mismatch, ignoring');
        return null;
      }

      return JSON.parse(data.content);
    } catch (error) {
      console.error('Cache retrieval failed:', error);
      return null;
    }
  }

  // Met en cache un document traité
  async set(file: File, result: ProcessingResult): Promise<void> {
    try {
      const hash = await computeHash(file);
      
      const { error } = await supabase
        .from('document_cache')
        .upsert({
          hash,
          content: JSON.stringify(result),
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          cached_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Cache storage failed:', error);
    }
  }

  // Nettoie les entrées expirées (appelé automatiquement par le trigger)
  async cleanup(): Promise<void> {
    try {
      const { error } = await supabase.rpc('cleanup_document_cache');
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }
}