import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const licenseApiBaseUrl = process.env.VIDEO_STITCHER_LICENSE_API_URL?.trim() ?? '';
const licenseSigningPublicKey = process.env.VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64
  ? Buffer.from(process.env.VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64, 'base64').toString('utf8')
  : '';
const updateBaseUrl = process.env.VIDEO_STITCHER_UPDATE_BASE_URL?.trim() ?? '';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __LICENSE_API_BASE_URL__: JSON.stringify(licenseApiBaseUrl),
      __LICENSE_SIGNING_PUBLIC_KEY__: JSON.stringify(licenseSigningPublicKey),
      __UPDATE_BASE_URL__: JSON.stringify(updateBaseUrl),
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          imageWorker: resolve(__dirname, 'src/main/workers/imageWorker.ts'),
        },
        external: ['ffmpeg-static', '@ffprobe-installer/ffprobe'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve(__dirname, 'src/preload'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
});
