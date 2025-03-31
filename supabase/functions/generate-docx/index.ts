import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "npm:docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function convertMarkdownToDocx(markdown: string, title: string): Document {
  // Split content into sections
  const sections = markdown.split('\n\n');
  const children: Paragraph[] = [];

  // Add title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { before: 400, after: 200 },
      style: {
        run: {
          color: '#f15922',
          size: 36,
          bold: true,
          font: 'Calibri'
        }
      }
    })
  );

  // Add date
  children.push(
    new Paragraph({
      text: new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      spacing: { before: 200, after: 400 },
      style: {
        run: {
          size: 24,
          font: 'Calibri',
          color: '#666666'
        }
      }
    })
  );

  for (const section of sections) {
    if (!section.trim()) continue;

    // Handle headings
    if (section.startsWith('# ')) {
      children.push(new Paragraph({
        text: section.replace('# ', ''),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        style: {
          run: {
            color: '#f15922',
            size: 32,
            bold: true,
            font: 'Calibri'
          }
        }
      }));
    } else if (section.startsWith('## ')) {
      children.push(new Paragraph({
        text: section.replace('## ', ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 180 },
        style: {
          run: {
            color: '#dba747',
            size: 28,
            bold: true,
            font: 'Calibri'
          }
        }
      }));
    } else if (section.startsWith('### ')) {
      children.push(new Paragraph({
        text: section.replace('### ', ''),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 320, after: 160 },
        style: {
          run: {
            size: 24,
            bold: true,
            font: 'Calibri'
          }
        }
      }));
    }
    // Handle lists
    else if (section.startsWith('- ')) {
      const items = section.split('\n');
      items.forEach(item => {
        if (item.startsWith('- ')) {
          children.push(new Paragraph({
            bullet: {
              level: 0
            },
            text: item.replace('- ', ''),
            spacing: { before: 120, after: 120 },
            style: {
              run: {
                size: 24,
                font: 'Calibri'
              }
            }
          }));
        }
      });
    }
    // Handle regular paragraphs
    else {
      children.push(new Paragraph({
        children: [
          new TextRun({
            text: section,
            size: 24,
            font: 'Calibri'
          })
        ],
        spacing: { before: 120, after: 120 }
      }));
    }
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440
          }
        }
      },
      children
    }]
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const { markdownContent, title } = await req.json();

    if (!markdownContent) {
      throw new Error('Markdown content is required');
    }

    // Convert markdown to DOCX
    const doc = convertMarkdownToDocx(markdownContent, title);
    const buffer = await Packer.toBuffer(doc);

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx"`,
      },
    });
  } catch (error) {
    console.error('Error in generate-docx function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while generating the docx file'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});