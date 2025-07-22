import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const audioDescription = formData.get('audioDescription') as string || undefined;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Processing audio file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      description: audioDescription
    });

    // Vérifier la clé API OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Préparer le FormData pour Whisper
    const whisperFormData = new FormData();
    whisperFormData.append('file', file);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('response_format', 'verbose_json');
    whisperFormData.append('language', 'fr');
    whisperFormData.append('prompt', 'Transcription en français. Respecter la ponctuation.');

    // Appeler l'API Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: whisperFormData
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Whisper API error:', errorData);
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const transcriptionData = await response.json();

    // Formatter le contenu avec la description si fournie
    let content = transcriptionData.text;
    if (audioDescription) {
      content = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription}\n\n== TRANSCRIPTION ==\n${transcriptionData.text}`;
    }

    // Préparer le résultat
    const result = {
      content,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: transcriptionData.duration || 0,
        language: 'fr',
        fileType: file.type,
        fileName: file.name,
        audioDescription,
        segments: transcriptionData.segments || []
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
    console.error('Error in process-audio function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while processing audio'
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