import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The spike imports from 'react-native' so the component code reads like
    // the future shared RN codebase; the web build resolves it to RNW.
    alias: { 'react-native': 'react-native-web' },
  },
});
