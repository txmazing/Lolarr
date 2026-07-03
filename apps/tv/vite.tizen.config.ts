import { defineLolarrReactConfig } from '../../config/vite/react.js'

export default defineLolarrReactConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist-tizen',
    target: 'es2017',
    cssCodeSplit: false,
    lib: {
      entry: 'src/main.tsx',
      name: 'LolarrTizen',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/lolarr-tizen.[ext]',
        entryFileNames: 'assets/lolarr-tizen.js',
      },
    },
  },
})
