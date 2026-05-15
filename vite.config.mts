import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    base: './', // CRITICAL for Electron to find index.html assets
    build: {
      outDir: 'build',
      emptyOutDir: true,
      assetsDir: 'assets',
    },
    server: {
      port: 3000,
    },
    define: {
      'process.env': {
         API_KEY: JSON.stringify(env.API_KEY || "")
      }
    }
  };
});