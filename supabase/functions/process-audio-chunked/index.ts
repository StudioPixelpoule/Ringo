import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Taille maximale par chunk (24MB pour être sûr)
const MAX_CHUNK_SIZE = 24 * 1024 * 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { filePath, fileName, audioDescription } = await req.json();
    if (!filePath) {
      throw new Error('No file path provided');
    }

    console.log(`Processing large audio file: ${fileName || filePath}`);

    // Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    const fileSize = fileData.size;
    console.log(`File size: ${Math.round(fileSize / 1024 / 1024)}MB`);

    // Si le fichier est assez petit, traiter directement
    if (fileSize <= MAX_CHUNK_SIZE) {
      return await processAudioChunk(fileData, fileName, audioDescription, 0, 1);
    }

    // Calculer le nombre de chunks nécessaires
    const numChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);
    console.log(`Splitting into ${numChunks} chunks`);

    // Convertir Blob en ArrayBuffer pour le découpage
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Traiter chaque chunk en parallèle
    const chunkPromises = [];
    for (let i = 0; i < numChunks; i++) {
      const start = i * MAX_CHUNK_SIZE;
      const end = Math.min(start + MAX_CHUNK_SIZE, fileSize);
      const chunkData = uint8Array.slice(start, end);
      const chunkBlob = new Blob([chunkData], { type: fileData.type });
      
      chunkPromises.push(
        processAudioChunk(chunkBlob, fileName, audioDescription, i, numChunks)
      );
    }

    // Attendre tous les chunks
    const results = await Promise.all(chunkPromises);

    // Fusionner les transcriptions
    const mergedTranscription = results
      .map((r, i) => {
        const timeOffset = i > 0 ? ` [Segment ${i + 1}/${numChunks}]` : '';
        return r.content + timeOffset;
      })
      .join('\n\n');

    // Fusionner les segments temporels
    let allSegments = [];
    let timeOffset = 0;
    
    for (const result of results) {
      const segments = result.metadata?.segments || [];
      const adjustedSegments = segments.map(seg => ({
        ...seg,
        start: seg.start + timeOffset,
        end: seg.end + timeOffset
      }));
      allSegments = allSegments.concat(adjustedSegments);
      
      // Estimer la durée de ce chunk pour le prochain offset
      if (segments.length > 0) {
        timeOffset += segments[segments.length - 1].end;
      }
    }

    const finalResult = {
      content: mergedTranscription,
      metadata: {
        title: fileName?.replace(/\.[^/.]+$/, '') || 'Audio transcrit',
        duration: timeOffset,
        language: 'fr',
        fileType: fileData.type,
        fileName: fileName,
        audioDescription,
        segments: allSegments,
        processedChunks: numChunks,
        originalSize: Math.round(fileSize / 1024 / 1024) + 'MB'
      }
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        result: finalResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in process-audio-chunked:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

async function processAudioChunk(
  chunkData: Blob,
  fileName: string | null,
  audioDescription: string | undefined,
  chunkIndex: number,
  totalChunks: number
): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Créer un nom de fichier pour ce chunk
  const chunkFileName = totalChunks > 1 
    ? `${fileName}_chunk_${chunkIndex + 1}_of_${totalChunks}.mp3`
    : fileName || 'audio.mp3';

  console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks}: ${chunkFileName}`);

  const audioFile = new File([chunkData], chunkFileName, { type: chunkData.type });

  const whisperFormData = new FormData();
  whisperFormData.append('file', audioFile);
  whisperFormData.append('model', 'whisper-1');
  whisperFormData.append('response_format', 'verbose_json');
  whisperFormData.append('language', 'fr');
  whisperFormData.append('prompt', 'Transcription en français. Respecter la ponctuation.');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: whisperFormData
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Whisper API error for chunk ${chunkIndex + 1}:`, errorData);
    throw new Error(`Transcription failed for chunk ${chunkIndex + 1}: ${response.statusText}`);
  }

  const transcriptionData = await response.json();

  let content = transcriptionData.text;
  if (audioDescription && chunkIndex === 0) {
    content = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription}\n\n== TRANSCRIPTION ==\n${transcriptionData.text}`;
  }

  return {
    content,
    metadata: {
      segments: transcriptionData.segments || [],
      duration: transcriptionData.duration || 0
    }
  };
} 