import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';
import imagemin from 'vite-plugin-imagemin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: [
        'path',
        'crypto',
        'stream',
        'buffer',
        'events',
        'process',
        'util',
        'os'
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      overrides: {
        os: 'os-browserify',
        stream: 'stream-browserify',
        crypto: 'crypto-browserify',
        path: 'path-browserify'
      }
    }),
    compression({
      algorithm: 'brotli',
      ext: '.br'
    }),
    imagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false
      },
      mozjpeg: {
        quality: 80
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox',
            active: false
          }
        ]
      },
      webp: {
        quality: 80
      }
    })
  ],
  build: {
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          pdf: ['pdfjs-dist'],
          ocr: ['tesseract.js'],
          markdown: [
            'react-markdown',
            'rehype-raw',
            'rehype-sanitize',
            'remark-gfm'
          ],
          ui: [
            'framer-motion',
            'lucide-react',
            'react-window'
          ],
          data: [
            'd3',
            'papaparse',
            'xlsx'
          ]
        }
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      path: 'path-browserify',
      os: 'os-browserify/browser'
    }
  },
  optimizeDeps: {
    include: [
      'buffer',
      'process',
      'events',
      'stream-browserify',
      'path-browserify',
      'crypto-browserify',
      'os-browserify'
    ],
    exclude: [
      'pdfjs-dist/build/pdf.worker.min.js'
    ]
  }
});