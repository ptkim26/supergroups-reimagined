import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 3001 },
  resolve: {
    alias: {
      '@shell': path.resolve(__dirname, 'shell'),
      '@concept-A': path.resolve(__dirname, 'concept-A'),
      '@concept-B': path.resolve(__dirname, 'concept-B'),
      '@concept-C': path.resolve(__dirname, 'concept-C'),
      '@concept-D': path.resolve(__dirname, 'concept-D'),
    },
  },
});
