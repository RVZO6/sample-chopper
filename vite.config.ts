import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';
import { downloadAudioBytes, resolveYouTubeAudio } from './api/youtube/audio';

/**
 * Vite configuration.
 * Handles React plugin, Tailwind, path aliases, and copying WASM dependencies.
 */
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
      {
        name: 'youtube-audio-api-dev',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use('/api/youtube/audio', async (req, res) => {
            const url = new URL(req.url || '/', 'http://localhost');
            const videoId = url.searchParams.get('videoId');
            const download = url.searchParams.get('download') === '1' || url.searchParams.get('download') === 'true';

            if (!videoId) {
              res.statusCode = 400;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing videoId query param' }));
              return;
            }

            try {
              const result = await resolveYouTubeAudio(videoId);
              if (download) {
                const bytes = Buffer.from(await downloadAudioBytes(videoId, result.client));

                res.statusCode = 200;
                res.setHeader('content-type', result.mimeType);
                res.setHeader('content-disposition', `inline; filename="youtube-${videoId}.${result.extension}"`);
                res.setHeader('content-length', String(bytes.byteLength));
                res.end(bytes);
                return;
              }

              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (error) {
              res.statusCode = 502;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
            }
          });
        }
      },
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
            src: 'node_modules/essentia.js/dist/essentia.js-core.js',
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
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
