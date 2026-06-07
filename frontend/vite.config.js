import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: '/drop4life/',
    build: {
      outDir: 'build',
      emptyOutDir: true,
    },
    define: {
      __APP_API_URL__: JSON.stringify(env.VITE_API_URL || ''),
    },
  };
});
