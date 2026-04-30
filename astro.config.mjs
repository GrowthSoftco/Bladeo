import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        '@supabase/supabase-js',
        'recharts',
      ],
    },
    server: {
      warmup: {
        clientFiles: ['./src/components/**/*.tsx'],
        ssrFiles: ['./src/pages/**/*.astro', './src/layouts/**/*.astro'],
      },
    },
  },
});
