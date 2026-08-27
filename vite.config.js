import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Zet REPO_NAME in .env.production op je GitHub repo-naam, of pas hieronder aan.
const repoName = process.env.REPO_NAME || 'verhuis_dashboard';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? `/${repoName}/` : '/',
  server: {
    port: 5173,
    open: true,
  },
}));
