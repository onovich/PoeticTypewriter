import { defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  base: '/PoeticTypewriter/',
  // Same-origin API on both workers.dev preview and the production custom domain.
  ...(mode === 'cloudflare' ? {
    plugins: [{
      name: 'cloudflare-asset-headers',
      // Wrangler serves dist-cloudflare, one level above Vite's subpath output.
      closeBundle() {
        copyFileSync(
          fileURLToPath(new URL('./config/cloudflare-headers', import.meta.url)),
          fileURLToPath(new URL('./dist-cloudflare/_headers', import.meta.url)),
        );
      },
    }],
    build: { outDir: 'dist-cloudflare/PoeticTypewriter', emptyOutDir: true },
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/PoeticTypewriter') },
  } : {}),
}));
