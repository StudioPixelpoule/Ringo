import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', 'reactflow', 'zustand'],
          utils: ['uuid', 'd3'],
          openai: ['openai'],
          document: ['mammoth', 'pdf-parse', 'xlsx']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
        // Augmenter les timeouts du proxy
        timeout: 600000, // 10 minutes
        proxyTimeout: 600000, // 10 minutes
        // Ajouter des options pour éviter les erreurs de socket hang up
        ws: true,
        secure: false,
        onProxyReq: (proxyReq) => {
          // Augmenter le timeout de la requête
          proxyReq.setHeader('Connection', 'keep-alive');
          proxyReq.setHeader('Keep-Alive', 'timeout=600');
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'lucide-react',
      'reactflow',
      'zustand',
      'uuid',
      'marked'
    ],
    exclude: [
      'fluent-ffmpeg'
    ]
  }
});