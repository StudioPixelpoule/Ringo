import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'classic'
  })],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
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
    host: true,
    port: 5173,
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, apikey',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/api/proxy': {
        target: 'https://api.allorigins.win',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, '/raw'),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
          });
        }
      },
      '/api/v1': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, '/v1'),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('OpenAI proxy error:', err);
          });
        }
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    cors: true
  }
});