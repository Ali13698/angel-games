import { defineConfig } from 'vite';

export default defineConfig({
  base: '/games/ludo/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
});
