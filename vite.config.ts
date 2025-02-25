import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4173, // ✅ Port dynamique Railway
    host: '0.0.0.0' // ✅ Autorise Railway à accéder au serveur
  }
});