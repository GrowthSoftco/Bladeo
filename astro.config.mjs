import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    optimizeDeps: {
      // Disable automatic dep crawling — fixes esbuild crash on Node v25 + Vite 7
      // Vite will still bundle deps on first request (lazy), just won't scan upfront
      noDiscovery: true,
    },
  },
});
