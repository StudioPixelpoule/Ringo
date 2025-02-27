import OpenAI from 'openai';
import type { Document } from './types';
import { getDocumentContent } from './documentProcessor';

// Fonction pour obtenir la clé API OpenAI
const getOpenAIKey = (): string => {
  // Vérifier d'abord dans localStorage
  const storedKey = localStorage.getItem('openai-api-key');
  if (storedKey) {
    return storedKey;
  }
  
  // Sinon, utiliser la variable d'environnement
  return import.meta.env.VITE_OPENAI_API_KEY || 'dummy-key';
};

// Créer une instance OpenAI avec la clé API
const createOpenAIClient = () => {
  return new OpenAI({
    apiKey: getOpenAIKey(),
    dangerouslyAllowBrowser: true // Nécessaire pour l'utilisation côté client
  });
};

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

export async function createChatCompletion({ 
  messages, 
  temperature = 0.7, 
  maxTokens = 1000 
}: ChatCompletionOptions) {
  try {
    // Obtenir la clé API
    const apiKey = getOpenAIKey();
    
    // Vérifier si la clé API est disponible
    if (apiKey === 'dummy-key' || apiKey === 'your-openai-api-key-here') {
      console.warn('[OPENAI] Clé API OpenAI non configurée. Retour d\'une réponse simulée.');
      return {
        content: "Je suis désolé, mais je ne peux pas traiter votre demande car la clé API OpenAI n'est pas configurée. Veuillez configurer votre clé API en cliquant sur le bouton 'Configurer' dans la bannière en bas de l'écran."
      };
    }
    
    // Créer un client OpenAI avec la clé actuelle
    const openai = createOpenAIClient();
    
    console.log('[OPENAI] Création d\'une complétion de chat avec', messages.length, 'messages');
    
    // Vérifier si le message contient une référence à un document partagé
    // mais ne contient pas encore le contenu du document
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const systemMessage = messages.find(m => m.role === 'system');
    
    if (lastUserMessage && 
        lastUserMessage.content.includes("**Document partagé:**") && 
        systemMessage && 
        !systemMessage.content.includes("L'utilisateur a partagé un document. Voici son contenu:")) {
      
      console.log('[OPENAI] Détection d\'un message de partage de document sans contenu');
      
      // Si l'utilisateur demande un résumé après avoir partagé un document
      // mais que le contenu n'a pas encore été extrait
      const previousMessages = messages.filter(m => m.role === 'user');
      if (previousMessages.length > 1) {
        const currentMessage = previousMessages[previousMessages.length - 1].content.toLowerCase();
        if (currentMessage.includes("resume") || 
            currentMessage.includes("résume") || 
            currentMessage.includes("résumé") || 
            currentMessage.includes("analyser")) {
          console.log('[OPENAI] Demande de résumé détectée mais contenu non disponible');
          return {
            content: "Je suis en train d'extraire le contenu du document que vous avez partagé. Veuillez patienter un instant pendant que je traite les informations..."
          };
        }
      }
      
      // Réponse standard pour un document partagé
      console.log('[OPENAI] Réponse standard pour un document partagé');
      return {
        content: "J'ai bien reçu le document que vous avez partagé. Je suis en train d'extraire son contenu. Que souhaitez-vous savoir à propos de ce document ? Je peux vous aider à l'analyser ou à répondre à des questions spécifiques sur son contenu."
      };
    }
    
    // Vérifier si le contenu du document est trop long
    const documentContent = systemMessage?.content.match(/L'utilisateur a partagé un document\. Voici son contenu:\n([\s\S]*?)(?=\n\nUtilise ces informations|$)/);
    if (documentContent && documentContent[1].length > 50000) {
      console.log('[OPENAI] Contenu du document trop long, troncature nécessaire');
      // Tronquer le contenu du document pour éviter de dépasser les limites de tokens
      const truncatedContent = documentContent[1].substring(0, 50000) + "\n\n[Contenu tronqué en raison de sa longueur...]";
      systemMessage.content = systemMessage.content.replace(documentContent[1], truncatedContent);
      
      console.warn('[OPENAI] Contenu du document tronqué pour respecter les limites de tokens.');
    }
    
    console.log('[OPENAI] Envoi de la requête à l\'API OpenAI');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Vous pouvez changer le modèle selon vos besoins
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    });

    console.log('[OPENAI] Réponse reçue de l\'API OpenAI, longueur:', response.choices[0].message.content?.length || 0);
    return response.choices[0].message;
  } catch (error) {
    console.error('[OPENAI] Erreur lors de la communication avec OpenAI:', error);
    
    // Vérifier si l'erreur est liée à la limite de tokens
    if (error instanceof Error && error.message.includes('maximum context length')) {
      console.log('[OPENAI] Erreur de limite de contexte détectée');
      return {
        content: "Je suis désolé, mais le document que vous avez partagé est trop volumineux pour être traité en une seule fois. Pourriez-vous me poser des questions spécifiques sur des parties du document, ou partager un extrait plus court ?"
      };
    }
    
    // Vérifier si l'erreur est liée à une clé API invalide
    if (error instanceof Error && 
        (error.message.includes('API key') || 
         error.message.includes('authentication') || 
         error.message.includes('401'))) {
      console.log('[OPENAI] Erreur d\'authentification détectée');
      return {
        content: "Je suis désolé, mais votre clé API OpenAI semble être invalide ou expirée. Veuillez vérifier et mettre à jour votre clé API en cliquant sur le bouton 'Configurer' dans la bannière en bas de l'écran."
      };
    }
    
    return {
      content: "Je suis désolé, une erreur s'est produite lors de la communication avec OpenAI. Veuillez réessayer plus tard ou contacter l'administrateur du système."
    };
  }
}

// Fonction pour générer un contexte à partir des documents
export async function generateContextFromDocuments(documents: Document[], query: string) {
  if (!documents || documents.length === 0) {
    console.log('[CONTEXT] Aucun document pertinent trouvé pour la requête:', query);
    return "Aucun document pertinent trouvé.";
  }
  
  try {
    console.log('[CONTEXT] Génération de contexte pour', documents.length, 'documents');
    
    // Obtenir la clé API
    const apiKey = getOpenAIKey();
    
    // Vérifier si la clé API est disponible
    if (apiKey === 'dummy-key' || apiKey === 'your-openai-api-key-here') {
      console.warn('[CONTEXT] Clé API OpenAI non configurée. Retour d\'un contexte simulé.');
      return "Contexte simulé: La clé API OpenAI n'est pas configurée. Les documents ne peuvent pas être analysés.";
    }
    
    // Créer un client OpenAI avec la clé actuelle
    const openai = createOpenAIClient();
    
    // Vérifier si la requête contient une référence à un document
    if (query.includes('**Document partagé:**')) {
      console.log('[CONTEXT] Requête contient une référence à un document partagé');
      return "L'utilisateur a partagé un document. Vous pouvez l'aider à analyser ce document ou répondre à des questions spécifiques sur son contenu.";
    }
    
    // Récupérer le contenu des documents pour un contexte plus riche
    console.log('[CONTEXT] Récupération du contenu des documents pour enrichir le contexte');
    const documentContents = await Promise.all(
      documents.map(async (doc) => {
        const content = await getDocumentContent(doc.id);
        // Limiter la taille du contenu pour éviter de dépasser les limites de tokens
        const truncatedContent = content && content.length > 1000 
          ? content.substring(0, 1000) + "..." 
          : content || "Contenu non disponible";
        return {
          name: doc.name,
          folder: doc.folder || 'Dossier racine',
          content: truncatedContent
        };
      })
    );
    
    // Créer un prompt pour l'extraction de contexte
    const prompt = `
Je suis Ringo, un assistant IA spécialisé pour l'IRSST (Institut de recherche Robert-Sauvé en santé et en sécurité du travail).
Voici une liste de documents pertinents pour répondre à la question de l'utilisateur.

Documents:
${documentContents.map((doc, index) => `
Document ${index + 1}: ${doc.name} (${doc.folder})
Extrait du contenu:
${doc.content}
---
`).join('\n')}

Question de l'utilisateur: ${query}

Basé sur ces documents, extrais les informations les plus pertinentes pour répondre à la question.
Organise ta réponse de manière structurée et concise.
`;

    console.log('[CONTEXT] Envoi de la requête de contexte à l\'API OpenAI');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
    });

    console.log('[CONTEXT] Contexte généré avec succès, longueur:', response.choices[0].message.content?.length || 0);
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error('[CONTEXT] Erreur lors de la génération du contexte:', error);
    return "Impossible de générer un contexte à partir des documents.";
  }
}

// Fonction pour résumer un document
export async function summarizeDocument(content: string, documentName: string, maxLength: number = 500): Promise<string> {
  if (!content || content.length < 100) {
    console.log('[SUMMARY] Document trop court pour générer un résumé:', content.length);
    return "Le document ne contient pas suffisamment de contenu pour générer un résumé.";
  }
  
  try {
    console.log('[SUMMARY] Génération d\'un résumé pour:', documentName);
    
    // Obtenir la clé API
    const apiKey = getOpenAIKey();
    
    // Vérifier si la clé API est disponible
    if (apiKey === 'dummy-key' || apiKey === 'your-openai-api-key-here') {
      console.warn('[SUMMARY] Clé API OpenAI non configurée. Impossible de générer un résumé.');
      return "Impossible de générer un résumé car la clé API OpenAI n'est pas configurée.";
    }
    
    // Créer un client OpenAI avec la clé actuelle
    const openai = createOpenAIClient();
    
    // Limiter la taille du contenu pour respecter les limites de tokens
    const maxInputLength = 15000;
    const truncatedContent = content.length > maxInputLength 
      ? content.substring(0, maxInputLength) + "\n\n[Contenu tronqué pour le résumé...]"
      : content;
    
    // Créer un prompt pour le résumé
    const prompt = `
Tu es un expert en résumé de documents pour l'IRSST (Institut de recherche Robert-Sauvé en santé et en sécurité du travail).
Voici le contenu d'un document intitulé "${documentName}".
Ton objectif est de créer un résumé structuré et informatif de ce document.

Le résumé doit:
1. Commencer par une introduction qui présente le document et son objectif
2. Identifier et présenter les points clés du document de manière structurée
3. Organiser l'information en sections logiques avec des sous-titres
4. Mettre en évidence les conclusions ou recommandations importantes
5. Être objectif et factuel
6. Être compréhensible sans avoir lu le document original

Utilise un format structuré avec des titres et sous-titres pour organiser l'information.
Limite le résumé à environ ${maxLength} mots.

Contenu du document:
${truncatedContent}
`;

    console.log('[SUMMARY] Envoi de la requête de résumé à l\'API OpenAI');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.5,
      max_tokens: 1500,
    });

    console.log('[SUMMARY] Résumé généré avec succès, longueur:', response.choices[0].message.content?.length || 0);
    return response.choices[0].message.content || "Impossible de générer un résumé pour ce document.";
  } catch (error) {
    console.error('[SUMMARY] Erreur lors de la génération du résumé:', error);
    return "Une erreur s'est produite lors de la génération du résumé. Veuillez réessayer plus tard.";
  }
}