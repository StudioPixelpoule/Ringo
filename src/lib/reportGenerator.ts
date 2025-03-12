import { ConversationDocument } from './conversationStore';
import { supabase } from './supabase';
import { generateChatResponse } from './openai';
import { jsPDF } from 'jspdf';

interface ReportTemplate {
  id: string;
  name: string;
  type: 'summary' | 'analysis' | 'comparison' | 'extraction';
}

async function getDocumentContent(doc: ConversationDocument): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('document_contents')
      .select('content')
      .eq('document_id', doc.document_id)
      .single();

    if (error) throw error;
    if (!data?.content) {
      throw new Error(`No content found for document: ${doc.documents.name}`);
    }

    return data.content;
  } catch (error) {
    console.error('Error fetching document content:', error);
    throw error;
  }
}

function getPromptForTemplate(template: ReportTemplate, documents: ConversationDocument[]): string {
  const basePrompt = `Tu es un expert en analyse de documents. Je veux que tu génères un rapport ${template.type === 'summary' ? 'synthétique' : 'détaillé'} basé sur ${documents.length} document(s).

Format attendu :
- Structure claire avec titres et sous-titres
- Points clés mis en évidence
- Synthèse des informations importantes
- Recommandations concrètes si pertinent

Le rapport doit suivre cette structure :

## Introduction
- Contexte et objectifs
- Documents analysés
- Méthodologie

`;

  switch (template.type) {
    case 'summary':
      return basePrompt + `
## Points Clés
- Synthèse des éléments essentiels
- Conclusions principales
- Messages importants à retenir

## Recommandations
- Actions suggérées
- Points d'attention
- Prochaines étapes

## Conclusion
- Synthèse globale
- Perspectives`;

    case 'analysis':
      return basePrompt + `
## Analyse Détaillée
- Examen approfondi du contenu
- Interprétation des données
- Points critiques identifiés

## Implications
- Impact sur les processus
- Conséquences potentielles
- Opportunités et risques

## Recommandations
- Actions prioritaires
- Solutions proposées
- Plan de mise en œuvre

## Conclusion
- Synthèse de l'analyse
- Points d'action
- Perspectives futures`;

    case 'comparison':
      return basePrompt + `
## Analyse Comparative
- Points communs
- Différences significatives
- Complémentarités

## Évaluation
- Forces et faiblesses
- Meilleures pratiques
- Points d'amélioration

## Recommandations
- Harmonisation suggérée
- Actions prioritaires
- Synergies potentielles

## Conclusion
- Synthèse comparative
- Orientations proposées`;

    case 'extraction':
      return basePrompt + `
## Données Extraites
- Informations clés
- Métriques importantes
- Tendances identifiées

## Analyse des Données
- Interprétation
- Corrélations
- Points notables

## Visualisation
- Tableaux récapitulatifs
- Points de données essentiels
- Structures identifiées

## Conclusion
- Synthèse des données
- Utilisation suggérée
- Prochaines analyses`;

    default:
      return basePrompt;
  }
}

export async function generateReport(documents: ConversationDocument[], template: ReportTemplate): Promise<Blob> {
  try {
    // Fetch content for all documents
    const contents = await Promise.all(
      documents.map(async doc => {
        const content = await getDocumentContent(doc);
        return `
====== DÉBUT DU DOCUMENT: ${doc.documents.name} (${doc.documents.type}) ======

${content}

====== FIN DU DOCUMENT: ${doc.documents.name} ======

INSTRUCTIONS: Le texte ci-dessus contient le contenu complet du document "${doc.documents.name}". Utilise ce contenu pour générer la section correspondante du rapport.
`;
      })
    );

    // Generate report content using OpenAI
    const prompt = getPromptForTemplate(template, documents);
    const reportContent = await generateChatResponse(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: contents.join('\n\n---\n\n') }
      ],
      contents.join('\n\n---\n\n')
    );

    // Create HTML report
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Rapport - ${template.name}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 40px;
          max-width: 800px;
          margin: 40px auto;
        }
        h1 { 
          color: #f15922; 
          font-size: 24px;
          margin-bottom: 10px;
        }
        h2 { 
          color: #dba747; 
          border-bottom: 1px solid #eee; 
          padding-bottom: 5px;
          margin-top: 30px;
          font-size: 20px;
        }
        h3 { 
          color: #444; 
          font-size: 18px;
          margin-top: 20px;
        }
        .header { 
          border-bottom: 2px solid #f15922; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .metadata {
          color: #666;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .content {
          margin: 20px 0;
        }
        .footer { 
          margin-top: 50px; 
          border-top: 1px solid #eee; 
          padding-top: 20px; 
          font-size: 12px;
          color: #666;
        }
        ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        li {
          margin: 5px 0;
        }
        strong {
          color: #f15922;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Rapport - ${template.name}</h1>
        <div class="metadata">
          <p>Généré le ${new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          <p>Type: ${template.type}</p>
        </div>
      </div>
      
      <div class="content">
        ${reportContent
          .replace(/\n/g, '<br>')
          .replace(/## (.*)/g, '<h2>$1</h2>')
          .replace(/### (.*)/g, '<h3>$1</h3>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/- (.*)/g, '<li>$1</li>')
          .replace(/<li>/g, '<ul><li>')
          .replace(/<\/li>\n/g, '</li></ul>')
        }
      </div>
      
      <div class="footer">
        <p>Documents analysés:</p>
        <ul>
          ${documents.map(d => `<li>${d.documents.name} (${d.documents.type})</li>`).join('')}
        </ul>
      </div>
    </body>
    </html>
  `;
  
    return new Blob([htmlContent], { type: 'text/html' });
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}