import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';

import fontGen from '@plextv/vite-plugin-msdf-fontgen';

// Tizen build: single IIFE bundle (no <script type="module">, no code-split
// chunks — Tizen's file:// WebKit can't resolve ES module imports). Modeled
// on apps/tv/vite.tizen.config.ts.
//
// Differences from apps/tv:
// - no CSS entry: Lightning renders everything to <canvas>, so there's no
//   stylesheet to emit/link (unlike apps/tv's lolarr-tizen.css).
// - the msdf-fontgen plugin still has to run pre-build so the atlas files
//   exist under public/fonts before tizen:sync copies them.
// - base app's optimizeDeps/build target is 'esnext' (dev speed). For the
//   Tizen bundle we need output JS syntax the M120-era WebKit (Tizen
//   required_version 2.3 floor is far below the real TV OS, Chrome94+) can
//   parse. es2017 is what apps/tv uses; @plextv/react-lightning's dist
//   already ships down-leveled JS, and esbuild during dep pre-bundling
//   respects the build target here too, so es2017 round-trips without
//   forcing the chrome94 fallback the brief allows for.
const config: InlineConfig = {
  plugins: [
    react(),
    fontGen({
      inputs: [
        {
          src: 'public/fonts',
          dest: 'public/fonts',
        },
      ],
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2017',
    },
  },
  worker: {
    // @lightningjs/renderer's ImageWorker is spawned from a stringified
    // function -> Blob URL at runtime (see ImageWorker.ts), not a
    // `new Worker(new URL(...))` module reference, so Vite/Rollup never
    // discovers or code-splits a worker chunk for it. This setting is a
    // defensive no-op for this app today, kept in case that changes.
    format: 'iife',
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist-tizen',
    target: 'es2017',
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.tsx',
      name: 'LolarrTvLightning',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/tv-lightning.[ext]',
        entryFileNames: 'assets/tv-lightning.js',
        // iife/umd formats can only emit a single chunk; react-lightning
        // uses dynamic import() internally (webgl/canvas shader variants,
        // a resize-observer shim) which Rollup must inline rather than
        // split into separate chunk files Tizen's file:// can't fetch.
        inlineDynamicImports: true,
      },
    },
  },
};

export default config;
