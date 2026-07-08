import type { InlineConfig } from 'vite';

// NOTE: the published package only exports a default (no named
// `reactNativeLightningPlugin` as the setup recipe assumed) — it returns an
// array bundling @vitejs/plugin-react + a react-compiler babel pass + the
// react-native alias/extension-resolution plugin.
import reactNativeLightningPlugin from '@plextv/vite-plugin-react-native-lightning';
import fontGen from '@plextv/vite-plugin-msdf-fontgen';

const config: InlineConfig = {
  plugins: [
    // Must be first: bundles @vitejs/plugin-react + aliases `react-native` ->
    // @plextv/react-native-lightning + resolves RN-style extensions.
    reactNativeLightningPlugin(),
    fontGen({
      inputs: [
        {
          src: 'public/fonts',
          dest: 'public/fonts',
        },
      ],
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
};

export default config;
