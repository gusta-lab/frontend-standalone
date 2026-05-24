import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKSTAGE_URL ?? 'http://localhost:7007',
        changeOrigin: true,
      },
      '/github-api': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/github-api/, ''),
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ''}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    },
  },
});
