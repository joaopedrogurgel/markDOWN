import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// BASE_PATH lets the same build serve from a sub-path, e.g. GitHub Pages ("/pauta/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
