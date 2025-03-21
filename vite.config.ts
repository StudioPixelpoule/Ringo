import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['xlsx']
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            '@supabase/supabase-js'
          ],
          'ui': [
            'lucide-react',
            'framer-motion'
          ],
          'markdown': [
            'react-markdown',
            'react-syntax-highlighter',
            'rehype-raw',
            'rehype-sanitize',
            'remark-gfm'
          ],
          'document-processing': [
            'mammoth',
            'tesseract.js',
            'xlsx',
            'papaparse',
            'pdfjs-dist'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});