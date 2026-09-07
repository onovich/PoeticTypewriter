import { defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seoAssets } from './scripts/seoPages.js';

export default defineConfig(({ mode }) => ({
  base: '/PoeticTypewriter/',
  plugins: [{ name: 'static-seo-pages', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/PoeticTypewriter\//, '');
      const asset = seoAssets().find(item => item.fileName === pathname || item.fileName === `${pathname}index.html`);
      if (!asset) return next();
      response.setHeader('Content-Type', asset.fileName.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/html; charset=utf-8');
      response.end(asset.source);
    });
  }, generateBundle() {
    for (const asset of seoAssets()) this.emitFile({ type: 'asset', ...asset });
  } }, ...(mode === 'cloudflare' ? [{
      name: 'cloudflare-asset-headers',
      // Wrangler serves dist-cloudflare, one level above Vite's subpath output.
      closeBundle() {
        copyFileSync(
          fileURLToPath(new URL('./config/cloudflare-headers', import.meta.url)),
          fileURLToPath(new URL('./dist-cloudflare/_headers', import.meta.url)),
        );
      },
    }] : [])],
  // Same-origin API on both workers.dev preview and the production custom domain.
  ...(mode === 'cloudflare' ? {
    build: { outDir: 'dist-cloudflare/PoeticTypewriter', emptyOutDir: true },
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/PoeticTypewriter') },
  } : {}),
}));
