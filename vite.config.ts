import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import viteImagemin from 'vite-plugin-imagemin';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react(),
      isProduction && viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        deleteOriginFile: false
      }),
      isProduction && viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        deleteOriginFile: false
      }),
      isProduction && viteImagemin({
        gifsicle: {
          optimizationLevel: 3,
          interlaced: false
        },
        mozjpeg: {
          quality: 80,
          progressive: true
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
          quality: 80,
          method: 6
        }
      })
    ].filter(Boolean),
    optimizeDeps: {
      include: ['xlsx']
    },
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      cssMinify: 'lightningcss',
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
          passes: 2,
          ecma: 2020,
          module: true
        },
        mangle: {
          properties: false
        },
        format: {
          comments: false,
          ecma: 2020
        }
      } : undefined,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React framework
            if (id.includes('react/') || id.includes('react-dom/')) {
              return 'react';
            }
            
            // Document processing (heavy)
            if (id.includes('pdfjs-dist/')) {
              return 'pdf-processing';
            }
            if (id.includes('tesseract.js/')) {
              return 'ocr-processing';
            }
            if (id.includes('mammoth/')) {
              return 'word-processing';
            }
            if (id.includes('xlsx/')) {
              return 'spreadsheet-processing';
            }
              
            // Markdown processing
            if (id.includes('react-markdown/') || 
                id.includes('rehype-') || 
                id.includes('remark-') ||
                id.includes('react-syntax-highlighter/')) {
              return 'markdown';
            }
              
            // Animations (heavy)
            if (id.includes('framer-motion/')) {
              return 'animations';
            }

            // Data visualization
            if (id.includes('d3/')) {
              return 'data-viz';
            }

            // State management
            if (id.includes('zustand/')) {
              return 'state';
            }

            // CSS chunks
            if (id.includes('.css')) {
              return 'styles';
            }

            // Vendor chunk for remaining deps
            if (id.includes('node_modules/')) {
              return 'vendor';
            }
          },
          assetFileNames: (assetInfo) => {
            let extType = assetInfo.name.split('.').at(1);
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              extType = 'img';
            } else if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
              extType = 'fonts';
            }
            return `assets/${extType}/[name]-[hash][extname]`;
          }
        }
      }
    },
    css: {
      modules: {
        localsConvention: 'camelCase',
        scopeBehaviour: 'local'
      },
      preprocessorOptions: {
        postcss: {
          plugins: [
            'tailwindcss',
            'autoprefixer',
            isProduction && 'cssnano'
          ].filter(Boolean)
        }
      }
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    }
  };
});