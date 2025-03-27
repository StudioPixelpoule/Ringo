import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Préchargement des modules critiques
const preloadModules = () => {
  const modules = [
    import('./lib/supabase.ts'),
    import('./lib/store.ts'),
    import('./lib/conversationStore.ts'),
    import('./lib/documentStore.ts')
  ];
  
  Promise.all(modules).catch(console.error);
};

// Création de l'application avec Strict Mode
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Préchargement après le rendu initial
requestIdleCallback(preloadModules);