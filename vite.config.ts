import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { offline } from './scripts/vite-plugin-offline.ts';

// BASE_PATH lets the same build serve from a sub-path, e.g. GitHub Pages ("/markDOWN/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), offline()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
