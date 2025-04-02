import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['xlsx', 'mammoth', 'tesseract.js', 'pdfjs-dist']
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui': ['lucide-react', 'framer-motion'],
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
          ],
          'file-processing': [
            'spark-md5',
            'web-streams-polyfill'
          ]
        }
      }
    },
    assetsInlineLimit: 4096
  },
  server: {
    hmr: {
      overlay: false // Disable error overlay to prevent crashes
    },
    watch: {
      usePolling: true, // Use polling for more reliable file watching
      interval: 100 // Check for changes every 100ms
    },
    headers: {
      'Cache-Control': 'no-store', // Prevent caching during development
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    supported: {
      'top-level-await': true
    }
  }
});