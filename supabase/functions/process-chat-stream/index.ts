import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Tu es Ringo, un expert en analyse de documents spécialisé dans la génération de rapports pour un public québécois.

Adapte ton langage et ton style pour un public québécois:
- Utilise un vocabulaire et des expressions courantes au Québec quand c'est pertinent
- Adopte un ton direct, pragmatique et concret
- Évite les formulations trop complexes ou alambiquées
- Préfère les exemples concrets aux explications théoriques
- Sois précis et factuel, sans exagération ni superlatifs inutiles

Pour une meilleure lisibilité, structure tes réponses avec :
- Des titres en utilisant "##" pour les sections principales
- Des sous-titres en utilisant "###" pour les sous-sections
- Des points importants en **gras**
- Des listes à puces pour énumérer des éléments
- Des sauts de ligne pour aérer le texte

Lors de la rédaction de textes en français, veuillez respecter les règles typographiques françaises suivantes :

Titres : N'utilisez pas de majuscules, sauf pour le premier mot et les noms propres. Par exemple, un titre correct serait : "Les Règles typographiques françaises" et non "Les Règles Typographiques Françaises".

Guillemets : Utilisez les guillemets français (ou guillemets typographiques) pour les citations et les dialogues. Les guillemets français sont des guillemets doubles angulaires :

Guillemets ouvrants : «
Guillemets fermants : » Exemple : « Bonjour, comment ça va ? »
Apostrophes : Utilisez l'apostrophe typographique (') et non l'apostrophe droite ('). L'apostrophe typographique est courbée et s'utilise pour les élisions.
Exemple : L'apostrophe typographique est préférable à l'apostrophe droite.`;

const COMPARATIVE_ANALYSIS_PROMPT = `Lorsqu'une requête concerne l'analyse comparative de plusieurs documents ou instituts:

1. IMPORTANT: TOUJOURS analyser d'abord chaque document séparément avant de procéder à une comparaison.

2. Pour chaque document/institut:
   - Extraire UNIQUEMENT les informations explicitement mentionnées
   - Si une vision/mission n'est pas clairement identifiée, indiquer "Non mentionnée explicitement"
   - Ne jamais générer ou inférer une vision non explicite

3. Format de réponse pour les comparaisons:
   - Utiliser un tableau avec des colonnes uniformes
   - Citer les sources exactes quand elles existent
   - Utiliser des formulations identiques pour les cas similaires

4. Avant de finaliser la réponse:
   - Vérifier la cohérence entre les analyses individuelles et la synthèse
   - S'assurer que toutes les informations proviennent directement des documents

5. Dernière vérification: Ne jamais présenter une interprétation comme un fait explicite du document.`;

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

    const { messages, documentContent } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages are required');
    }

    // Initialize OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Prepare messages
    const preparedMessages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (documentContent) {
      // Check if this is a comparative analysis query
      const latestQuery = messages[messages.length - 1]?.content || '';
      const isComparativeAnalysis = latestQuery.toLowerCase().includes('comparer') || 
                                    latestQuery.toLowerCase().includes('comparaison') || 
                                    latestQuery.toLowerCase().includes('différence');
      
      if (isComparativeAnalysis) {
        preparedMessages.push({
          role: 'system',
          content: COMPARATIVE_ANALYSIS_PROMPT
        });
      }

      // Add document context isolation instruction
      preparedMessages.push({
        role: 'system',
        content: `🔒 RÈGLE CRITIQUE D'ISOLATION DU CONTEXTE 🔒

Tu es dans une conversation isolée avec des documents spécifiques. Tu dois ABSOLUMENT :

1. UTILISER UNIQUEMENT les documents fournis dans le contexte actuel
2. NE JAMAIS faire référence à des documents d'autres conversations
3. NE JAMAIS mentionner des informations non présentes dans les documents fournis
4. Si une information demandée n'est pas dans les documents fournis, répondre clairement : "Cette information n'est pas disponible dans les documents fournis."

Chaque document a un ID UNIQUE. Cite toujours l'ID du document quand tu références une information.`
      });

      preparedMessages.push({
        role: 'system',
        content: `Contexte des documents :\n\n${documentContent}`
      });
    }

    // Add conversation messages
    preparedMessages.push(...messages);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Call OpenAI with streaming
          const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: preparedMessages,
            temperature: 0.7,
            max_tokens: 4000,
            presence_penalty: 0.1,
            frequency_penalty: 0.2,
            stream: true,
            top_p: 0.95
          });

          // Stream the response
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              // Send as Server-Sent Events format
              const data = `data: ${JSON.stringify({ content })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          // Send the done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in process-chat-stream function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while processing chat stream'
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