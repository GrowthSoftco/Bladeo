import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

// `astro dev`   → process.argv[2] === 'dev'
// `astro build` → process.argv[2] === 'build'
const isDev = process.argv[2] === 'dev';

export default defineConfig({
  output: 'server',

  // In dev: use the lightweight Node.js adapter in MIDDLEWARE mode.
  //   - 'standalone' tries to own its own HTTP server and conflicts with
  //     Vite's dev server → connection refused.
  //   - 'middleware' lets Vite stay in control of the dev server and only
  //     adds Node.js SSR handling — no port conflicts, much less overhead
  //     than emulating the full Vercel serverless runtime.
  // In production build: keep the Vercel adapter.
  adapter: isDev
    ? node({ mode: 'middleware' })
    : vercel(),

  integrations: [react()],

  vite: {
    optimizeDeps: {
      // noDiscovery avoids the esbuild crash on Node v25 + Vite 7.
      // We explicitly list heavy packages so they're pre-bundled on startup
      // instead of lazily on first request.
      noDiscovery: true,
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@supabase/supabase-js',
        'recharts',
      ],
    },
  },
});
