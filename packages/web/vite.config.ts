import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.HMR_CLIENT_PORT ? { clientPort: Number(process.env.HMR_CLIENT_PORT) } : true,
    open: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: `http://localhost:${process.env.API_PORT ?? 4000}`, changeOrigin: true },
    },
  },
  base: process.env.NODE_ENV === 'production' ? '/kov-cs-poetry/' : '/',
});
