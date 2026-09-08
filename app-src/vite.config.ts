import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
    sourcemap: true
  }
});
