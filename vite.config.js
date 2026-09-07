import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: '/PoeticTypewriter/',
  // Same-origin API on both workers.dev preview and the production custom domain.
  ...(mode === 'cloudflare' ? {
    build: { outDir: 'dist-cloudflare/PoeticTypewriter', emptyOutDir: true },
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/PoeticTypewriter') },
  } : {}),
}));
