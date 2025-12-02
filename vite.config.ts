import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
    },
    preview: {
      port: 3000,
      strictPort: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/essentia.js/dist/essentia-wasm.web.wasm',
            dest: 'essentia'
          },
          {
            src: 'node_modules/essentia.js/dist/essentia-wasm.web.js',
            dest: 'essentia'
          },
          {
            src: 'node_modules/rubberband-wasm/dist/rubberband.wasm',
            dest: 'rubberband'
          }
        ]
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
