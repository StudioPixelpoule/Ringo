import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ModalProvider } from './components/ModalProvider';
import './index.css';
import { config } from './lib/config';

// Validate environment variables before mounting app
try {
  // Config validation happens on import
  if (process.env.NODE_ENV === 'development') {
    console.debug('Environment validated, config loaded:', {
      supabaseUrl: config.supabase.url,
      hasAnonKey: !!config.supabase.anonKey,
      hasServiceKey: !!config.supabase.serviceKey,
      hasOpenAIKey: !!config.openai.apiKey
    });
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  createRoot(rootElement).render(
    <React.StrictMode>
      <ModalProvider>
        <App />
      </ModalProvider>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to start application:', error);
  
  // Show error to user
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-center;
        padding: 2rem;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
        background: #f15922;
        color: white;
      ">
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">
          Erreur de Configuration
        </h1>
        <p style="max-width: 600px; margin-bottom: 2rem;">
          Une erreur est survenue lors du démarrage de l'application. 
          Veuillez contacter l'administrateur système.
        </p>
        <pre style="
          background: rgba(0,0,0,0.1);
          padding: 1rem;
          border-radius: 0.5rem;
          max-width: 100%;
          overflow-x: auto;
          text-align: left;
        ">${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    `;
  }
}