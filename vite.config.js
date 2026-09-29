import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  // Keep local development/Firebase Hosting unchanged; Pages serves a repository subpath.
  base: mode === 'github-pages' ? '/Vocabulary-with-Ralina/' : './',
  build: {
    target: 'es2022',
    rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks(id) {
      if (id.includes('@firebase/firestore') || id.includes('/firebase/firestore/')) return 'firebase-database';
      if (id.includes('@firebase/auth') || id.includes('/firebase/auth/')) return 'firebase-auth';
      if (id.includes('node_modules')) return 'vendor';
    } } },
  },
}));
