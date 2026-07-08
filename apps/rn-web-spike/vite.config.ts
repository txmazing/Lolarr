import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// RN-ecosystem packages (reanimated) ship platform splits as *.web.js —
// both vite's source resolution AND the dep optimizer must prefer them,
// otherwise the native variants get pulled in, which require react-native
// internals that react-native-web doesn't ship (ReactFabric shims etc.).
const RN_WEB_EXTENSIONS = [
  '.web.tsx',
  '.web.ts',
  '.web.jsx',
  '.web.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.json',
];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // RN packages expect metro-provided globals.
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    'process.env': '({})',
    __DEV__: JSON.stringify(mode !== 'production'),
    global: 'globalThis',
  },
  resolve: {
    // The spike imports from 'react-native' so the component code reads like
    // the future shared RN codebase; the web build resolves it to RNW.
    alias: { 'react-native': 'react-native-web' },
    extensions: RN_WEB_EXTENSIONS,
  },
  optimizeDeps: {
    // Pre-bundle reanimated (it contains CJS files that must be converted
    // to ESM); the rolldown-based optimizer needs the .web.* extension list
    // separately from resolve.extensions above.
    include: ['react-native-reanimated', 'react-native-worklets'],
    rollupOptions: {
      resolve: { extensions: RN_WEB_EXTENSIONS },
    },
  },
}));
