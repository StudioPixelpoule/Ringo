import { ConversationDocument } from './conversationStore';
import { supabase } from './supabase';
import { generateChatResponse } from './openai';
import { ReportTemplate } from './reportTemplateService';

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

function validateStructure(content: string, template: ReportTemplate): boolean {
  if (!template.structure?.sections) return true;

  const requiredSections = template.structure.sections
    .filter(section => section.required)
    .map(section => section.title.toLowerCase());

  const contentSections = content
    .split('\n')
    .filter(line => line.startsWith('## '))
    .map(line => line.replace('## ', '').toLowerCase());

  return requiredSections.every(required => 
    contentSections.some(section => section.includes(required))
  );
}

export async function generateReport(
  documents: ConversationDocument[], 
  template: ReportTemplate
): Promise<Blob> {
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

    // Prepare the prompt with structure validation
    const structureInstructions = template.structure?.sections
      ? `\nSTRUCTURE REQUISE:\n\n${
          template.structure.sections
            .map(section => `## ${section.title}${section.required ? ' (Obligatoire)' : ''}`)
            .join('\n\n')
        }`
      : '';

    const prompt = `${template.prompt}

INSTRUCTIONS IMPORTANTES:
1. Respecte STRICTEMENT la structure définie
2. Utilise les titres de section exactement comme spécifiés
3. Assure-toi que toutes les sections obligatoires sont présentes
4. Maintiens une cohérence dans le formatage${structureInstructions}

DOCUMENTS À ANALYSER:
${contents.join('\n\n---\n\n')}`;

    // Generate report content
    let reportContent = await generateChatResponse(
      [
        { 
          role: 'system', 
          content: `Tu es un expert en analyse de documents spécialisé dans la génération de rapports de type "${template.type}". 
                   Ton objectif est de générer un rapport professionnel en suivant EXACTEMENT la structure et les instructions fournies.
                   
                   RÈGLES DE MISE EN FORME:
                   1. Utilise ## pour les titres de sections principaux (H2)
                   2. Utilise ### pour les sous-sections (H3)
                   3. Utilise **texte** pour mettre en évidence les points importants
                   4. Utilise des listes à puces (-) pour énumérer les points
                   5. Ajoute des sauts de ligne pour aérer le texte
                   6. Évite les styles de texte excessifs ou incohérents
                   7. Assure une hiérarchie claire des informations
                   8. Ne jamais utiliser le caractère # seul sur une ligne
                   9. Aligner parfaitement les puces des listes de même niveau` 
        },
        { role: 'user', content: prompt }
      ],
      contents.join('\n\n---\n\n')
    );

    // Validate structure
    if (!validateStructure(reportContent, template)) {
      console.warn('Report structure validation failed, regenerating...');
      
      // Add more explicit instructions
      reportContent = await generateChatResponse(
        [
          { 
            role: 'system', 
            content: `ATTENTION: La structure précédente n'était pas conforme. 
                     Tu DOIS utiliser EXACTEMENT les titres de section suivants:
                     ${template.structure?.sections.map(s => `## ${s.title}`).join('\n')}` 
          },
          { role: 'user', content: prompt }
        ],
        contents.join('\n\n---\n\n')
      );

      // Final validation
      if (!validateStructure(reportContent, template)) {
        throw new Error('Impossible de générer un rapport conforme à la structure requise');
      }
    }

    // Clean up any standalone # characters
    reportContent = reportContent.replace(/^#\s*$/gm, '');

    // Create HTML report
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport - ${template.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        /* Reset CSS */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        /* Base styles */
        :root {
          --page-width: 21cm;
          --page-height: 29.7cm;
          --margin: 2cm;
          --primary-color: #333333;
          --secondary-color: #666666;
          --accent-color: #106f69;
          --border-color: #e5e5e5;
          --background-color: #ffffff;
        }
        
        /* Page layout */
        @page {
          size: A4;
          margin: var(--margin);
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: var(--primary-color);
          background: var(--background-color);
          max-width: var(--page-width);
          margin: 0 auto;
          padding: 0;
        }

        /* Header */
        .header {
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .header h1 {
          font-size: 24pt;
          font-weight: 700;
          color: var(--primary-color);
          margin-bottom: 0.5rem;
          line-height: 1.2;
          page-break-after: avoid;
        }

        .metadata {
          color: var(--secondary-color);
          font-size: 9pt;
          line-height: 1.4;
        }

        /* Content */
        .content {
          margin: 2rem 0;
        }

        /* Typography */
        h2 {
          font-size: 16pt;
          font-weight: 600;
          color: var(--primary-color);
          margin: 2rem 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
          line-height: 1.3;
          page-break-after: avoid;
          clear: both;
        }

        h3 {
          font-size: 14pt;
          font-weight: 600;
          color: var(--primary-color);
          margin: 1.5rem 0 0.75rem;
          line-height: 1.3;
          page-break-after: avoid;
        }

        p {
          margin-bottom: 0.75rem;
          line-height: 1.6;
          text-align: justify;
          hyphens: auto;
        }

        /* Lists */
        ul, ol {
          margin: 0.75rem 0;
          padding-left: 2.5rem;
          page-break-inside: avoid;
        }

        li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
          position: relative;
          text-align: justify;
          padding-left: 0.5rem;
        }

        ul li {
          list-style-type: none;
        }

        ul li::before {
          content: "•";
          color: var(--accent-color);
          font-weight: bold;
          position: absolute;
          left: -1.5rem;
          width: 1rem;
          text-align: center;
        }

        /* Nested lists */
        ul ul, ol ol, ul ol, ol ul {
          margin: 0.5rem 0 0.5rem 0;
          padding-left: 2rem;
        }

        /* Emphasis */
        strong {
          font-weight: 600;
          color: var(--primary-color);
        }

        em {
          font-style: italic;
          color: var(--secondary-color);
        }

        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 10pt;
          page-break-inside: avoid;
        }

        th, td {
          padding: 0.75rem;
          text-align: left;
          border: 1px solid var(--border-color);
          vertical-align: top;
        }

        th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: var(--primary-color);
        }

        tr:nth-child(even) {
          background-color: #fafafa;
        }

        /* Footer */
        .footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
          color: var(--secondary-color);
          font-size: 9pt;
          page-break-before: avoid;
        }

        .footer h4 {
          color: var(--primary-color);
          font-size: 10pt;
          margin-bottom: 0.5rem;
        }

        .footer ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .footer li {
          margin: 0.25rem 0;
        }

        /* Print-specific styles */
        @media print {
          body {
            width: var(--page-width);
            height: var(--page-height);
            margin: 0;
            padding: 0;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Avoid page breaks inside elements */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            page-break-inside: avoid;
          }

          table, figure, ul, ol {
            page-break-inside: avoid;
          }

          /* Force page breaks before major sections */
          h1 {
            page-break-before: always;
          }

          /* Ensure footer stays at bottom */
          .footer {
            position: running(footer);
            margin-top: 2rem;
          }

          @page {
            @bottom-center {
              content: counter(page);
            }
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${template.name}</h1>
        <div class="metadata">
          <p>Généré le ${new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          <p>Type : ${template.type}</p>
          ${template.description ? `<p>${template.description}</p>` : ''}
        </div>
      </div>
      
      <div class="content">
        ${reportContent
          // Clean up multiple line breaks
          .replace(/\n{3,}/g, '\n\n')
          // Remove standalone # characters
          .replace(/^#\s*$/gm, '')
          // Handle headings
          .replace(/## (.*?)(?=\n|$)/g, '</div><h2>$1</h2><div class="section">')
          .replace(/### (.*?)(?=\n|$)/g, '</div><h3>$1</h3><div class="subsection">')
          // Handle bold text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          // Handle lists with proper nesting
          .replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '\n<li>$1</li>')
          .replace(/(?:^|\n)<li>/g, '\n<ul><li>')
          .replace(/(?:^|\n)<\/li>(?:\n|$)/g, '</li></ul>\n')
          // Handle paragraphs
          .replace(/(?:^|\n)([^<\n].*?)(?=\n|$)/g, '<p>$1</p>')
          // Clean up empty paragraphs
          .replace(/<p>\s*<\/p>/g, '')
          // Clean up nested lists
          .replace(/<\/ul>\s*<ul>/g, '')
          // Clean up extra divs
          .replace(/<div class="section">\s*<\/div>/g, '')
          .replace(/<div class="subsection">\s*<\/div>/g, '')
          // Add initial div
          .replace(/^/, '<div class="section">')
          // Close final div
          .replace(/$/, '</div>')
          // Clean up multiple spaces
          .replace(/\s{2,}/g, ' ')
          // Clean up empty lines
          .replace(/\n{2,}/g, '\n')
        }
      </div>
      
      <div class="footer">
        <h4>Documents analysés</h4>
        <ul>
          ${documents.map(d => `
            <li>
              <strong>${d.documents.name}</strong>
              <span class="text-sm text-gray-500">(${d.documents.type})</span>
            </li>
          `).join('')}
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