import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') || corsHeaders['Access-Control-Allow-Headers']
      }
    });
  }

  try {
    const {
      invitation,
      appUrl = 'http://localhost:5173'  // Default to local dev URL
    } = await req.json();

    if (!invitation?.email || !invitation?.token) {
      throw new Error('Email and token are required');
    }

    const client = new SmtpClient();

    await client.connectTLS({
      hostname: Deno.env.get('SMTP_HOSTNAME') || '',
      port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
      username: Deno.env.get('SMTP_USERNAME') || '',
      password: Deno.env.get('SMTP_PASSWORD') || '',
    });

    const inviteUrl = `${appUrl}/accept-invitation?token=${invitation.token}`;
    const roleDisplay = invitation.role === 'super_admin' ? 'Super Administrateur' :
                       invitation.role === 'admin' ? 'Administrateur' : 
                       'Utilisateur';

    await client.send({
      from: Deno.env.get('SMTP_FROM') || '',
      to: invitation.email,
      subject: "Invitation à rejoindre RINGO",
      content: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #f15922; margin-bottom: 20px;">Bienvenue sur RINGO</h1>
              
              <p>Vous avez été invité(e) à rejoindre RINGO en tant que ${roleDisplay}.</p>
              
              <p>Pour accepter cette invitation et créer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
              
              <div style="margin: 30px 0;">
                <a href="${inviteUrl}" 
                   style="background-color: #f15922; 
                          color: white; 
                          padding: 12px 24px; 
                          text-decoration: none; 
                          border-radius: 4px;
                          display: inline-block;">
                  Créer mon compte
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Ce lien d'invitation expirera dans 24 heures.
                Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #888; font-size: 12px;">
                  Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      html: true,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error sending invitation:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while sending the invitation'
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