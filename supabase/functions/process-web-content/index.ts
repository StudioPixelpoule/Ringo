import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import OpenAI from "npm:openai@4.28.0";

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

    const { url, htmlContent, description } = await req.json();

    if (!url || !htmlContent) {
      throw new Error('URL and HTML content are required');
    }

    // Initialize OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Call OpenAI to extract and structure the content
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a web content extraction specialist. Extract and structure the main content from HTML, removing navigation, ads, and other non-essential elements. Format the content using Markdown.

Focus on:
1. Main article or page content
2. Headings and subheadings
3. Important text and paragraphs
4. Lists and structured data
5. Key information and facts

Remove:
- Navigation menus
- Advertisements
- Footer information
- Sidebar widgets
- Scripts and styles
- Comments

Format the output as clean Markdown with proper structure.`
        },
        {
          role: 'user',
          content: `Extract the main content from this webpage:\n\nURL: ${url}\n\nHTML Content:\n${htmlContent.substring(0, 50000)}` // Limite à 50k caractères
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      presence_penalty: 0,
      frequency_penalty: 0
    });

    const extractedContent = completion.choices[0]?.message?.content;
    if (!extractedContent) {
      throw new Error('Failed to extract content from webpage');
    }

    // Format the final content
    let formattedContent = `# Contenu Web : ${new URL(url).hostname}\n\n`;
    formattedContent += `**URL Source :** ${url}\n`;
    formattedContent += `**Date d'extraction :** ${new Date().toLocaleDateString('fr-FR')}\n`;
    if (description) {
      formattedContent += `**Description :** ${description}\n`;
    }
    formattedContent += `\n---\n\n`;
    formattedContent += extractedContent;

    return new Response(
      JSON.stringify({ 
        success: true,
        content: formattedContent,
        metadata: {
          url,
          extractedAt: new Date().toISOString(),
          description
        }
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
    console.error('Error in process-web-content function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while processing web content'
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