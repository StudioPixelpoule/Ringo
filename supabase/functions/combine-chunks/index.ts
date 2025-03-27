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

const BATCH_SIZE = 5; // Process 5 chunks at a time

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

    // Process chunks in batches
    const totalBatches = Math.ceil(totalChunks / BATCH_SIZE);
    let combinedArray = new Uint8Array(0);

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchChunks: Uint8Array[] = [];
      const startChunk = batch * BATCH_SIZE;
      const endChunk = Math.min(startChunk + BATCH_SIZE, totalChunks);

      // Download chunks for this batch
      for (let i = startChunk; i < endChunk; i++) {
        const { data, error: downloadError } = await supabase.storage
          .from('documents')
          .download(`${filePath}_part_${i}`);

        if (downloadError) {
          console.error(`Error downloading chunk ${i}:`, downloadError);
          throw downloadError;
        }

        const chunk = new Uint8Array(await data.arrayBuffer());
        batchChunks.push(chunk);
      }

      // Combine this batch with previous chunks
      const batchSize = batchChunks.reduce((size, chunk) => size + chunk.length, 0);
      const newArray = new Uint8Array(combinedArray.length + batchSize);
      newArray.set(combinedArray, 0);

      let offset = combinedArray.length;
      for (const chunk of batchChunks) {
        newArray.set(chunk, offset);
        offset += chunk.length;
      }

      combinedArray = newArray;

      // Clean up processed chunks
      for (let i = startChunk; i < endChunk; i++) {
        await supabase.storage
          .from('documents')
          .remove([`${filePath}_part_${i}`])
          .catch(error => {
            console.warn(`Failed to cleanup chunk ${i}:`, error);
          });
      }
    }

    // Upload combined file
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, combinedArray, {
        contentType: fileType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading combined file:', uploadError);
      throw uploadError;
    }

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

    if (cacheError) {
      console.error('Error updating cache:', cacheError);
      throw cacheError;
    }

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