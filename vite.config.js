import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks(id) {
      if (id.includes('@firebase/firestore') || id.includes('/firebase/firestore/')) return 'firebase-database';
      if (id.includes('@firebase/auth') || id.includes('/firebase/auth/')) return 'firebase-auth';
      if (id.includes('node_modules')) return 'vendor';
    } } },
  },
});
