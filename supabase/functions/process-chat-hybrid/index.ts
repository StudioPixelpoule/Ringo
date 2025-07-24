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
  documentLimit: 6,        // Basculer vers Claude au-delà de 6 documents (aligné avec le frontend)
  complexityKeywords: ['comparer', 'comparaison', 'analyse approfondie', 'synthèse complexe', 'analyse détaillée', 'synthétiser'],
};

// Flag temporaire pour forcer OpenAI (peut être mis à jour dynamiquement)
let forceOpenAIFallback = false; // Mode hybride complet avec fallback automatique
let forceOpenAIUntil: number | null = null;

// Compteur d'erreurs 529 pour Claude
let claudeOverloadCount = 0;
const OVERLOAD_THRESHOLD = 3; // Après 3 erreurs 529, forcer OpenAI temporairement
const FALLBACK_DURATION = 10 * 60 * 1000; // 10 minutes

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
- Vérification systématique de chaque mot avant de l'écrire
- INTERDICTION absolue de mots tronqués, coupés ou mal formés

IMPORTANT - Cohérence visuelle et textuelle :
- Maintenir une mise en forme cohérente tout au long de la réponse
- Ne jamais couper un mot au milieu
- Respecter l'intégrité de chaque terme technique
- S'assurer que chaque phrase est complète et bien formée
- Éviter toute compression ou abréviation non standard

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
- Des tableaux markdown quand approprié pour comparer des données

RÈGLES DE FORMATAGE STRICTES :
- Toujours utiliser le format markdown standard
- Ne jamais utiliser de syntaxe propriétaire ou spécifique à un modèle
- Assurer une cohérence parfaite dans l'utilisation des symboles markdown
- Respecter exactement la même structure de formatage que GPT-4o

VÉRIFICATION FINALE : Avant de répondre, TOUJOURS relire mentalement ta réponse pour t'assurer qu'il n'y a AUCUNE erreur linguistique et que la mise en forme est parfaite.

Lors de la rédaction de textes en français, veuillez respecter les règles typographiques françaises suivantes :

Titres : N'utilisez pas de majuscules, sauf pour le premier mot et les noms propres. Par exemple, un titre correct serait : "Les règles typographiques françaises" et non "Les Règles Typographiques Françaises".

Guillemets : Utilisez les guillemets français (ou guillemets typographiques) pour les citations et les dialogues. Les guillemets français sont des guillemets doubles angulaires :

Guillemets ouvrants : «
Guillemets fermants : » 
Exemple : « Bonjour, comment ça va ? »

Apostrophes : Utilisez l'apostrophe typographique (') et non l'apostrophe droite ('). L'apostrophe typographique est courbée et s'utilise pour les élisions.
Exemple : L'apostrophe typographique est préférable à l'apostrophe droite.

Espaces et ponctuation : Respecter les espaces insécables avant : ; ! ? et à l'intérieur des guillemets français.`;

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

// Cache pour les erreurs récentes de Claude
interface ClaudeHealthStatus {
  lastError?: Date;
  consecutiveErrors: number;
  isHealthy: boolean;
  nextRetryTime?: Date;
}

let claudeStatus: ClaudeHealthStatus = {
  consecutiveErrors: 0,
  isHealthy: true
};

// Fonction pour vérifier si Claude est probablement disponible
function isClaudeLikelyAvailable(): boolean {
  // Si on a forcé OpenAI temporairement
  if (forceOpenAIFallback && forceOpenAIUntil && Date.now() < forceOpenAIUntil) {
    console.log(`[Claude Health] Still in forced OpenAI mode until ${new Date(forceOpenAIUntil).toISOString()}`);
    return false;
  }
  
  // Si on a eu une erreur récente, attendre avant de réessayer
  if (claudeStatus.nextRetryTime && Date.now() < claudeStatus.nextRetryTime.getTime()) {
    console.log(`[Claude Health] Waiting until ${claudeStatus.nextRetryTime.toISOString()} before retry`);
    return false;
  }
  
  return true;
}

// Fonction pour mettre à jour le statut de Claude
function updateClaudeStatus(success: boolean, error?: any) {
  if (success) {
    claudeStatus = {
      consecutiveErrors: 0,
      isHealthy: true
    };
    console.log('[Claude Health] Claude is healthy again');
  } else {
    claudeStatus.consecutiveErrors++;
    claudeStatus.lastError = new Date();
    
    // Calculer le prochain temps de retry (backoff exponentiel)
    const backoffMinutes = Math.min(Math.pow(2, claudeStatus.consecutiveErrors - 1), 30); // Max 30 minutes
    claudeStatus.nextRetryTime = new Date(Date.now() + backoffMinutes * 60 * 1000);
    
    if (claudeStatus.consecutiveErrors >= 3) {
      claudeStatus.isHealthy = false;
    }
    
    console.log(`[Claude Health] Error recorded. Consecutive: ${claudeStatus.consecutiveErrors}, Next retry: ${claudeStatus.nextRetryTime.toISOString()}`);
  }
}

// Fonction pour déterminer le meilleur modèle
function selectBestModel(messages: any[], documentContent?: string): {
  model: 'openai' | 'claude';
  reason: string;
  estimatedTokens: number;
} {
  // Si Claude n'est pas disponible, utiliser OpenAI directement
  if (!isClaudeLikelyAvailable()) {
    console.log(`[SelectModel] Claude temporarily unavailable, using OpenAI`);
    return {
      model: 'openai',
      reason: 'Claude temporairement indisponible (protection anti-surcharge)',
      estimatedTokens: 0
    };
  }
  
  // Si le fallback forcé est activé, utiliser OpenAI
  if (forceOpenAIFallback) {
    console.log(`[SelectModel] Forcing OpenAI due to fallback flag`);
    return {
      model: 'openai',
      reason: 'Fallback forcé (problèmes Claude)',
      estimatedTokens: 0
    };
  }
  
  // Calculer le nombre total de tokens
  let totalTokens = 0;
  
  // Tokens des messages système
  totalTokens += estimateTokens(SYSTEM_PROMPT);
  
  // Tokens du contenu des documents
  if (documentContent) {
    totalTokens += estimateTokens(documentContent);
    
    // Compter le nombre de documents
    const documentCount = (documentContent.match(/====== DOCUMENT ACTIF/g) || []).length;
    
    console.log(`[SelectModel] Document count: ${documentCount}, Threshold: ${SELECTION_THRESHOLDS.documentLimit}`);
    
    // Si plus de 4 documents, préférer Claude
    if (documentCount > SELECTION_THRESHOLDS.documentLimit) {
      console.log(`[SelectModel] Selecting Claude - Document count (${documentCount}) exceeds threshold`);
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
  
  console.log(`[SelectModel] Total estimated tokens: ${totalTokens}`);
  
  // Vérifier si la requête est complexe
  const lastMessage = messages[messages.length - 1]?.content || '';
  const isComplexQuery = SELECTION_THRESHOLDS.complexityKeywords.some(keyword => 
    lastMessage.toLowerCase().includes(keyword)
  );
  
  if (isComplexQuery) {
    console.log(`[SelectModel] Selecting Claude - Complex query detected`);
    return {
      model: 'claude',
      reason: 'Requête complexe détectée',
      estimatedTokens: totalTokens
    };
  }
  
  // Si les tokens dépassent le seuil, utiliser Claude
  if (totalTokens > SELECTION_THRESHOLDS.tokenLimit) {
    console.log(`[SelectModel] Selecting Claude - Token limit exceeded`);
    return {
      model: 'claude',
      reason: `Dépassement du seuil de tokens (${totalTokens} > ${SELECTION_THRESHOLDS.tokenLimit})`,
      estimatedTokens: totalTokens
    };
  }
  
  // Par défaut, utiliser OpenAI (plus rapide et moins cher)
  console.log(`[SelectModel] Selecting OpenAI - Default choice (${documentCount || 0} documents, ${totalTokens} tokens)`);
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
    // Pour le streaming, essayer d'abord de créer le stream Claude
    // Si ça échoue avec une erreur 529, propager l'erreur immédiatement
    try {
      console.log('[Claude] Creating stream...');
      const claudeStream = await anthropic.messages.create({
        model: MODEL_CONFIG.claude.model,
        max_tokens: MODEL_CONFIG.claude.maxTokens,
        temperature: 0.7,
        system: systemMessage,
        messages: userMessages,
        stream: true,
        // Paramètres additionnels pour améliorer la qualité
        top_p: 0.95,
        top_k: 0,
      });
      
      console.log('[Claude] Stream created successfully, starting to process...');
      
      // Si on arrive ici, le stream a été créé avec succès
      const encoder = new TextEncoder();
      return new ReadableStream({
        async start(controller) {
          try {
            // Buffer pour éviter les mots coupés
            let buffer = '';
            let totalChunks = 0;
            let totalContent = '';
            
            console.log('[Claude Streaming] Starting to read chunks...');
            
            for await (const chunk of claudeStream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const content = chunk.delta.text;
                if (content) {
                  totalChunks++;
                  totalContent += content;
                  
                  // Ajouter au buffer
                  buffer += content;
                  
                  // Envoyer le contenu de manière plus agressive pour éviter les blocages
                  const bufferSize = buffer.length;
                  
                  // Conditions pour envoyer le buffer
                  const shouldSend = 
                    bufferSize > 100 || // Buffer trop grand
                    buffer.endsWith('.') || 
                    buffer.endsWith('!') || 
                    buffer.endsWith('?') ||
                    buffer.endsWith('\n') ||
                    buffer.endsWith(':') ||
                    buffer.endsWith(';');
                  
                  if (shouldSend) {
                    // Si on a un point de coupure naturel, on l'utilise
                    const lastSpaceIndex = buffer.lastIndexOf(' ');
                    const lastNewlineIndex = buffer.lastIndexOf('\n');
                    const cutIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
                    
                    let toSend = buffer;
                    let remaining = '';
                    
                    // Si on trouve un bon point de coupure et qu'il n'est pas trop loin
                    if (cutIndex > 0 && cutIndex > bufferSize * 0.5) {
                      toSend = buffer.substring(0, cutIndex + 1);
                      remaining = buffer.substring(cutIndex + 1);
                    }
                    
                    const data = `data: ${JSON.stringify({ content: toSend, model: 'claude' })}\n\n`;
                    controller.enqueue(encoder.encode(data));
                    buffer = remaining;
                    
                    console.log(`[Claude Streaming] Sent chunk ${totalChunks}: ${toSend.length} chars`);
                  }
                }
              } else if (chunk.type === 'content_block_stop') {
                console.log('[Claude Streaming] Content block stopped');
              }
            }
            
            // Envoyer le reste du buffer
            if (buffer) {
              console.log(`[Claude Streaming] Sending final buffer: ${buffer.length} chars`);
              const data = `data: ${JSON.stringify({ content: buffer, model: 'claude' })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            
            console.log(`[Claude Streaming] Stream completed. Total chunks: ${totalChunks}, Total content: ${totalContent.length} chars`);
            
            // IMPORTANT: Envoyer le signal de fin
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (error: any) {
            console.error('[Claude Streaming] Error during streaming:', error);
            // Envoyer l'erreur dans le stream
            const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } finally {
            controller.close();
          }
        },
      });
    } catch (error: any) {
      console.error('[Claude] Failed to create stream:', error);
      console.log(`[Claude] Error status: ${error.status}`);
      // Si c'est une erreur 529, la propager immédiatement
      if (error.status === 529 || error.message?.includes('Overloaded')) {
        console.log('[Claude] Propagating 529 error for fallback...');
        throw error;
      }
      // Pour les autres erreurs aussi, les propager
      throw error;
    }
  } else {
    // Réponse normale sans streaming
    const message = await anthropic.messages.create({
      model: MODEL_CONFIG.claude.model,
      max_tokens: MODEL_CONFIG.claude.maxTokens,
      temperature: 0.7,
      system: systemMessage,
      messages: userMessages,
      // Paramètres additionnels pour améliorer la qualité
      top_p: 0.95,
      top_k: 0,
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
    // Analyser le contenu pour déterminer le type d'analyse
    const latestQuery = documentContent.match(/Question récente: (.+)/)?.[1] || '';
    const isComparativeAnalysis = latestQuery.toLowerCase().includes('comparer') || 
                                  latestQuery.toLowerCase().includes('comparaison') || 
                                  latestQuery.toLowerCase().includes('différence');
    
    if (isComparativeAnalysis) {
      systemContent += `\n\n${COMPARATIVE_ANALYSIS_PROMPT}`;
    }
    
    systemContent += `\n\n🔒 RÈGLE CRITIQUE D'ISOLATION DU CONTEXTE 🔒

Tu es dans une conversation isolée avec des documents spécifiques. Tu dois ABSOLUMENT :

1. UTILISER UNIQUEMENT les documents fournis dans le contexte actuel
2. NE JAMAIS faire référence à des documents d'autres conversations
3. NE JAMAIS mentionner des informations non présentes dans les documents fournis
4. Si une information demandée n'est pas dans les documents fournis, répondre clairement : "Cette information n'est pas disponible dans les documents fournis."

Chaque document a un NOM. Cite toujours le nom du document (tel qu'il apparaît dans le TITRE) quand tu références une information, en utilisant le format : "Document : [nom du fichier]".

🎯 OPTIMISATION DU TRAVAIL SUR LES DOCUMENTS 🎯

Pour maximiser l'efficacité de l'analyse documentaire :

1. **Extraction intelligente** : Identifie et extrait automatiquement les informations clés de chaque document
2. **Synthèse structurée** : Organise les informations de manière logique et hiérarchique
3. **Analyse croisée** : Identifie les relations, contradictions et complémentarités entre documents
4. **Citations précises** : Toujours indiquer la source exacte (document + section/page si disponible)
5. **Tableaux comparatifs** : Utilise des tableaux markdown pour présenter des comparaisons claires
6. **Résumés exécutifs** : Fournis des synthèses concises en début de réponse pour les analyses complexes

CAPACITÉS AVANCÉES AVEC PLUSIEURS DOCUMENTS :
- Analyse comparative approfondie
- Identification de tendances et patterns
- Consolidation d'informations dispersées
- Création de vues d'ensemble structurées
- Détection d'incohérences ou de lacunes
- Génération de recommandations basées sur l'ensemble des documents

Contexte des documents :

${documentContent}

RAPPEL FINAL : Exploite au maximum la richesse des documents fournis tout en respectant strictement leur contenu. Ne jamais inventer ou supposer des informations non présentes.`;
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
  // Vérifier si le fallback forcé a expiré
  if (forceOpenAIUntil && Date.now() > forceOpenAIUntil) {
    forceOpenAIFallback = false;
    forceOpenAIUntil = null;
    claudeOverloadCount = 0;
    console.log('[Hybrid] Force OpenAI fallback expired, returning to normal operation');
  }
  
  // Sélectionner le meilleur modèle si pas de préférence
  const selection = preferredModel 
    ? { model: preferredModel, reason: 'Modèle spécifié', estimatedTokens: 0 }
    : selectBestModel(messages, documentContent);
  
  console.log(`[Hybrid] Model selected: ${selection.model} - Reason: ${selection.reason}`);
  
  try {
    // Essayer avec le modèle sélectionné
    if (selection.model === 'claude') {
      console.log('[Hybrid] Attempting to process with Claude...');
      const response = await processWithClaude(messages, documentContent, stream);
      // Réinitialiser le compteur si succès
      claudeOverloadCount = 0;
      updateClaudeStatus(true); // Claude fonctionne bien
      console.log('[Hybrid] Claude processing successful');
      return { response, model: 'claude', reason: selection.reason };
    } else {
      console.log('[Hybrid] Attempting to process with OpenAI...');
      const response = await processWithOpenAI(messages, documentContent, stream);
      console.log('[Hybrid] OpenAI processing successful');
      return { response, model: 'openai', reason: selection.reason };
    }
  } catch (error: any) {
    console.error(`[Hybrid] Error with ${selection.model}:`, error);
    console.log(`[Hybrid] Error status: ${error.status}, Message: ${error.message}`);
    
    // Vérifier si c'est une erreur de surcharge (529)
    const isOverloaded = error.status === 529 || error.message?.includes('Overloaded');
    console.log(`[Hybrid] Is overloaded error: ${isOverloaded}`);
    
    // Si Claude est surchargé, mettre à jour le statut
    if (isOverloaded && selection.model === 'claude') {
      updateClaudeStatus(false, error);
      claudeOverloadCount++;
      console.log(`[Hybrid] Claude overload count: ${claudeOverloadCount}/${OVERLOAD_THRESHOLD}`);
      
      // Si trop d'erreurs, activer le fallback forcé
      if (claudeOverloadCount >= OVERLOAD_THRESHOLD) {
        forceOpenAIFallback = true;
        forceOpenAIUntil = Date.now() + FALLBACK_DURATION;
        console.log(`[Hybrid] Too many Claude overloads, forcing OpenAI for ${FALLBACK_DURATION/1000} seconds`);
      }
    }
    
    // Pour le streaming, on doit créer un nouveau stream pour le fallback
    if (stream && isOverloaded && selection.model === 'claude') {
      console.log(`[Hybrid] Claude overloaded (529), immediate fallback to OpenAI`);
      console.log(`[Hybrid] Headers will show: Model=openai, Reason=Fallback transparent (Claude surchargé)`);
      
      try {
        console.log('[Hybrid] Attempting OpenAI fallback for streaming...');
        const response = await processWithOpenAI(messages, documentContent, stream);
        console.log('[Hybrid] OpenAI fallback successful - User won\'t notice any interruption');
        
        // Log pour monitoring
        console.log(`[Hybrid Stats] Claude failures: ${claudeOverloadCount}, Force until: ${forceOpenAIUntil ? new Date(forceOpenAIUntil).toISOString() : 'Not set'}`);
        
        return { 
          response, 
          model: 'openai', 
          reason: `Bascule transparente (Claude temporairement indisponible)` 
        };
      } catch (fallbackError: any) {
        console.error(`[Hybrid] Fallback to OpenAI also failed:`, fallbackError);
        
        // Si on est en mode streaming, créer un stream d'erreur gracieux
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            const errorMessage = `Désolé, le service est temporairement indisponible. Veuillez réessayer dans quelques instants.`;
            const errorData = `data: ${JSON.stringify({ content: errorMessage, model: 'error' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        });
        return {
          response: errorStream,
          model: 'error',
          reason: `Services temporairement indisponibles`
        };
      }
    }
    
    // Fallback général sur l'autre modèle
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
    } catch (fallbackError: any) {
      console.error(`[Hybrid] Fallback also failed:`, fallbackError);
      
      // Si on est en mode streaming, créer un stream d'erreur
      if (stream) {
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            const errorMessage = `Désolé, les services d'IA sont temporairement indisponibles. Veuillez réessayer dans quelques instants.`;
            const errorData = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        });
        return {
          response: errorStream,
          model: 'error',
          reason: `Échec des deux modèles: ${selection.model} (${error.message}) et ${fallbackModel} (${fallbackError.message})`
        };
      }
      
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

    // Parse request body
    const { messages, documentContent, stream = false } = await req.json();

    console.log('[Hybrid API] Request received:', {
      messagesCount: messages?.length || 0,
      hasDocumentContent: !!documentContent,
      documentCount: documentContent ? (documentContent.match(/====== DOCUMENT ACTIF/g) || []).length : 0,
      stream: stream
    });

    // Valider les messages
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages are required');
    }

    // Vérifier les clés API
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    console.log('[Hybrid API] API Keys status:', {
      openaiConfigured: !!openaiKey,
      anthropicConfigured: !!anthropicKey
    });

    if (!openaiKey && !anthropicKey) {
      throw new Error('Aucune clé API configurée');
    }

    // Process with fallback
    const { response, model, reason } = await processWithFallback(
      messages,
      documentContent,
      stream
    );

    console.log(`[Hybrid API] Response generated with ${model} - Reason: ${reason}`);

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

    // Retourner le résultat selon le mode
    if (stream && response instanceof ReadableStream) {
      return new Response(response, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Model-Used': model,
          'X-Model-Reason': reason,
        },
      });
    } else {
      return new Response(
        JSON.stringify({ 
          success: true,
          response: response,
          model: model,
          reason: reason
        }),
        {
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Model-Used': model,
            'X-Model-Reason': reason,
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