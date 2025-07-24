import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import OpenAI from "npm:openai@4.28.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Configuration des modèles
const MODEL_CONFIG = {
  openai: {
    model: 'gpt-4o',
    maxTokens: 4000,
    contextWindow: 128000,
  },
  claude: {
    model: 'claude-3-opus-20240229', // ou claude-3-sonnet-20240229 pour un coût réduit
    maxTokens: 4000,
    contextWindow: 200000,
  }
};

// Seuils de sélection
const SELECTION_THRESHOLDS = {
  tokenLimit: 100000,      // Basculer vers Claude au-delà
  documentLimit: 8,        // Basculer vers Claude au-delà
  complexityKeywords: ['comparer', 'comparaison', 'analyse approfondie', 'synthèse complexe'],
};

// Prompts système identiques pour cohérence
const SYSTEM_PROMPT = `Tu es Ringo, un expert en analyse de documents spécialisé dans la génération de rapports pour un public québécois.

🔴 RÈGLE ABSOLUE DE QUALITÉ LINGUISTIQUE 🔴
Tu DOIS produire des réponses PARFAITES sur le plan grammatical et orthographique :
- AUCUNE faute d'orthographe tolérée
- AUCUNE erreur grammaticale acceptée
- Syntaxe française impeccable
- Ponctuation correcte et appropriée
- Accords grammaticaux respectés (genre, nombre, temps)
- Conjugaisons exactes

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

VÉRIFICATION FINALE : Avant de répondre, TOUJOURS relire mentalement ta réponse pour t'assurer qu'il n'y a AUCUNE erreur linguistique.

Lors de la rédaction de textes en français, veuillez respecter les règles typographiques françaises suivantes :

Titres : N'utilisez pas de majuscules, sauf pour le premier mot et les noms propres. Par exemple, un titre correct serait : "Les règles typographiques françaises" et non "Les Règles Typographiques Françaises".

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

// Fonction pour estimer les tokens (approximation)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Fonction pour déterminer le meilleur modèle
function selectBestModel(messages: any[], documentContent?: string): {
  model: 'openai' | 'claude';
  reason: string;
  estimatedTokens: number;
} {
  // Calculer le nombre total de tokens
  let totalTokens = 0;
  
  // Tokens des messages système
  totalTokens += estimateTokens(SYSTEM_PROMPT);
  
  // Tokens du contenu des documents
  if (documentContent) {
    totalTokens += estimateTokens(documentContent);
    
    // Compter le nombre de documents
    const documentCount = (documentContent.match(/====== DOCUMENT ACTIF/g) || []).length;
    
    // Si plus de 8 documents, préférer Claude
    if (documentCount > SELECTION_THRESHOLDS.documentLimit) {
      return {
        model: 'claude',
        reason: `Plus de ${SELECTION_THRESHOLDS.documentLimit} documents (${documentCount})`,
        estimatedTokens: totalTokens
      };
    }
  }
  
  // Tokens des messages de conversation
  messages.forEach(msg => {
    totalTokens += estimateTokens(JSON.stringify(msg));
  });
  
  // Vérifier si la requête est complexe
  const lastMessage = messages[messages.length - 1]?.content || '';
  const isComplexQuery = SELECTION_THRESHOLDS.complexityKeywords.some(keyword => 
    lastMessage.toLowerCase().includes(keyword)
  );
  
  if (isComplexQuery) {
    return {
      model: 'claude',
      reason: 'Requête complexe détectée',
      estimatedTokens: totalTokens
    };
  }
  
  // Si les tokens dépassent le seuil, utiliser Claude
  if (totalTokens > SELECTION_THRESHOLDS.tokenLimit) {
    return {
      model: 'claude',
      reason: `Dépassement du seuil de tokens (${totalTokens} > ${SELECTION_THRESHOLDS.tokenLimit})`,
      estimatedTokens: totalTokens
    };
  }
  
  // Par défaut, utiliser OpenAI (plus rapide et moins cher)
  return {
    model: 'openai',
    reason: 'Utilisation standard',
    estimatedTokens: totalTokens
  };
}

// Fonction pour traiter avec OpenAI
async function processWithOpenAI(
  messages: any[],
  documentContent?: string,
  stream: boolean = false
): Promise<string | ReadableStream> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const openai = new OpenAI({ apiKey: openaiApiKey });
  
  const preparedMessages = prepareMessages(messages, documentContent);
  
  if (stream) {
    // Retourner un stream pour le streaming
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await openai.chat.completions.create({
            model: MODEL_CONFIG.openai.model,
            messages: preparedMessages,
            temperature: 0.7,
            max_tokens: MODEL_CONFIG.openai.maxTokens,
            presence_penalty: 0.1,
            frequency_penalty: 0.2,
            stream: true,
            top_p: 0.95
          });
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = `data: ${JSON.stringify({ content, model: 'openai' })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('OpenAI streaming error:', error);
          const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      },
    });
  } else {
    // Réponse normale sans streaming
    const completion = await openai.chat.completions.create({
      model: MODEL_CONFIG.openai.model,
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: MODEL_CONFIG.openai.maxTokens,
      presence_penalty: 0.1,
      frequency_penalty: 0.2,
      top_p: 0.95
    });
    
    return completion.choices[0]?.message?.content || '';
  }
}

// Fonction pour traiter avec Claude
async function processWithClaude(
  messages: any[],
  documentContent?: string,
  stream: boolean = false
): Promise<string | ReadableStream> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }
  
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  
  // Préparer les messages pour Claude (format différent)
  const systemMessage = prepareSystemMessageForClaude(documentContent);
  const userMessages = messages.filter(m => m.role !== 'system');
  
  if (stream) {
    // Retourner un stream pour le streaming
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await anthropic.messages.create({
            model: MODEL_CONFIG.claude.model,
            max_tokens: MODEL_CONFIG.claude.maxTokens,
            temperature: 0.7,
            system: systemMessage,
            messages: userMessages,
            stream: true,
          });
          
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const content = chunk.delta.text;
              if (content) {
                const data = `data: ${JSON.stringify({ content, model: 'claude' })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Claude streaming error:', error);
          const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      },
    });
  } else {
    // Réponse normale sans streaming
    const message = await anthropic.messages.create({
      model: MODEL_CONFIG.claude.model,
      max_tokens: MODEL_CONFIG.claude.maxTokens,
      temperature: 0.7,
      system: systemMessage,
      messages: userMessages,
    });
    
    return message.content[0]?.text || '';
  }
}

// Préparer les messages pour OpenAI
function prepareMessages(messages: any[], documentContent?: string): any[] {
  const preparedMessages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];
  
  if (documentContent) {
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
    
    preparedMessages.push({
      role: 'system',
      content: `🔒 RÈGLE CRITIQUE D'ISOLATION DU CONTEXTE 🔒

Tu es dans une conversation isolée avec des documents spécifiques. Tu dois ABSOLUMENT :

1. UTILISER UNIQUEMENT les documents fournis dans le contexte actuel
2. NE JAMAIS faire référence à des documents d'autres conversations
3. NE JAMAIS mentionner des informations non présentes dans les documents fournis
4. Si une information demandée n'est pas dans les documents fournis, répondre clairement : "Cette information n'est pas disponible dans les documents fournis."

Chaque document a un NOM. Cite toujours le nom du document (tel qu'il apparaît dans le TITRE) quand tu références une information, en utilisant le format : "Document : [nom du fichier]".`
    });
    
    preparedMessages.push({
      role: 'system',
      content: `Contexte des documents :\n\n${documentContent}`
    });
  }
  
  preparedMessages.push(...messages);
  return preparedMessages;
}

// Préparer le message système pour Claude
function prepareSystemMessageForClaude(documentContent?: string): string {
  let systemContent = SYSTEM_PROMPT;
  
  if (documentContent) {
    systemContent += `\n\n${COMPARATIVE_ANALYSIS_PROMPT}`;
    systemContent += `\n\n🔒 RÈGLE CRITIQUE D'ISOLATION DU CONTEXTE 🔒

Tu es dans une conversation isolée avec des documents spécifiques. Tu dois ABSOLUMENT :

1. UTILISER UNIQUEMENT les documents fournis dans le contexte actuel
2. NE JAMAIS faire référence à des documents d'autres conversations
3. NE JAMAIS mentionner des informations non présentes dans les documents fournis
4. Si une information demandée n'est pas dans les documents fournis, répondre clairement : "Cette information n'est pas disponible dans les documents fournis."

Chaque document a un NOM. Cite toujours le nom du document (tel qu'il apparaît dans le TITRE) quand tu références une information, en utilisant le format : "Document : [nom du fichier]".`;
    
    systemContent += `\n\nContexte des documents :\n\n${documentContent}`;
  }
  
  return systemContent;
}

// Fonction principale avec fallback automatique
async function processWithFallback(
  messages: any[],
  documentContent?: string,
  stream: boolean = false,
  preferredModel?: 'openai' | 'claude'
): Promise<{ response: string | ReadableStream; model: string; reason: string }> {
  // Sélectionner le meilleur modèle si pas de préférence
  const selection = preferredModel 
    ? { model: preferredModel, reason: 'Modèle spécifié', estimatedTokens: 0 }
    : selectBestModel(messages, documentContent);
  
  console.log(`[Hybrid] Model selected: ${selection.model} - Reason: ${selection.reason}`);
  
  try {
    // Essayer avec le modèle sélectionné
    if (selection.model === 'claude') {
      const response = await processWithClaude(messages, documentContent, stream);
      return { response, model: 'claude', reason: selection.reason };
    } else {
      const response = await processWithOpenAI(messages, documentContent, stream);
      return { response, model: 'openai', reason: selection.reason };
    }
  } catch (error) {
    console.error(`[Hybrid] Error with ${selection.model}:`, error);
    
    // Fallback sur l'autre modèle
    const fallbackModel = selection.model === 'openai' ? 'claude' : 'openai';
    console.log(`[Hybrid] Falling back to ${fallbackModel}`);
    
    try {
      if (fallbackModel === 'claude') {
        const response = await processWithClaude(messages, documentContent, stream);
        return { response, model: 'claude', reason: `Fallback après erreur ${selection.model}` };
      } else {
        const response = await processWithOpenAI(messages, documentContent, stream);
        return { response, model: 'openai', reason: `Fallback après erreur ${selection.model}` };
      }
    } catch (fallbackError) {
      console.error(`[Hybrid] Fallback also failed:`, fallbackError);
      throw new Error(`Échec des deux modèles: ${error.message} | ${fallbackError.message}`);
    }
  }
}

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

    const { messages, documentContent, stream = false, preferredModel } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages are required');
    }

    // Traiter la requête avec fallback automatique
    const result = await processWithFallback(messages, documentContent, stream, preferredModel);

    // Retourner le résultat selon le mode
    if (stream && result.response instanceof ReadableStream) {
      return new Response(result.response, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Model-Used': result.model,
          'X-Model-Reason': result.reason,
        },
      });
    } else {
      return new Response(
        JSON.stringify({ 
          success: true,
          response: result.response,
          model: result.model,
          reason: result.reason
        }),
        {
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Model-Used': result.model,
            'X-Model-Reason': result.reason,
          },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('[Hybrid] Error in process-chat-hybrid function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while processing chat'
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