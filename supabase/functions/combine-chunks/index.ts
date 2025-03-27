import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

interface RequestBody {
  filePath: string;
  totalChunks: number;
  fileHash: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

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
    const body = await req.json() as RequestBody;
    const { filePath, totalChunks, fileHash, fileName, fileType, fileSize } = body;

    if (!filePath || !totalChunks || !fileHash || !fileName || !fileType || !fileSize) {
      throw new Error('Missing required parameters');
    }

    // Create Supabase client
    const supabaseAdmin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!supabaseAdmin || !supabaseUrl) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseAdmin, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Download and combine chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(`${filePath}_part_${i}`);

      if (error) throw error;
      
      const chunk = new Uint8Array(await data.arrayBuffer());
      chunks.push(chunk);
    }

    // Combine chunks
    const combinedSize = chunks.reduce((size, chunk) => size + chunk.length, 0);
    const combinedArray = new Uint8Array(combinedSize);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }

    // Upload combined file
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, combinedArray, {
        contentType: fileType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Store file info in cache
    const { error: cacheError } = await supabase
      .from('document_cache')
      .upsert([{
        hash: fileHash,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        cached_at: new Date().toISOString()
      }]);

    if (cacheError) throw cacheError;

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in combine-chunks function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while combining chunks'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});