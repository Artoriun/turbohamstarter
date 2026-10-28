import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * GitHub Pages serves a project site from /<repo>/, so the built assets need that prefix.
 * Set BASE_PATH to '/your-repo-name/' (the CI workflow passes it). A user/organisation
 * site, or a custom domain, serves from the root — leave it unset.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  plugins: [react()],
  server: {
    // Not 3000: Playwright reuses an already-running server at this port, so a stray dev
    // server from another project would silently host the whole layout suite. Overridable
    // via WEB_PORT.
    port: Number(process.env.WEB_PORT ?? 3720),
    // Fail rather than hop to the next free port — Playwright would then be pointed at
    // nothing, or worse, at whatever else answers here.
    strictPort: true,
    host: '0.0.0.0',
    open: true,
    allowedHosts: true,
    // So `fetch('/api/...')` works in dev without CORS or a build-time URL.
    proxy: {
      '/api': { target: `http://localhost:${process.env.API_PORT ?? 3700}`, changeOrigin: true },
    },
  },
  base: process.env.NODE_ENV === 'production' ? base : '/',
  build: {
    // The budget script parses this directory; keep them in step if you change it.
    outDir: 'dist',
  },
});
