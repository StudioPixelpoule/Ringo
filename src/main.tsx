import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupGlobalErrorHandling } from './lib/logger.ts';

// Configurer la capture des erreurs globales
setupGlobalErrorHandling();

// Mesurer le temps de démarrage
const startTime = performance.now();

// Créer l'élément racine
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("L'élément racine n'a pas été trouvé");
}

// Rendre l'application
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Mesurer le temps de rendu
window.addEventListener('load', () => {
  const loadTime = performance.now() - startTime;
  console.log(`Application chargée en ${loadTime.toFixed(2)}ms`);
});