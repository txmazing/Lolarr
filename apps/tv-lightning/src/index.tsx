// Types for flex props (View/Text/Image style props extended with
// flexDirection/gap/etc) come from this side-effect-only types import.
import '@plextv/react-lightning-plugin-flexbox/jsx';

import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { RenderOptions } from '@plextv/react-lightning';
import { NativeCanvas, getReactNativePlugins } from '@plextv/react-native-lightning';

import { App } from './App';
import { keyMap } from './keyMap';
import { startProbe } from './probe';

const queryClient = new QueryClient();

// Spike-only auto measurement probe (self-delays 15s, see src/probe.ts).
startProbe();

const options: RenderOptions = {
  fonts: [
    {
      type: 'sdf',
      fontFamily: 'sans-serif',
      // Relative (not absolute) so the Tizen file:// bundle resolves them
      // from tizen/index.html's own directory (./fonts/...). At the root
      // path '/' in dev this is equivalent to the old absolute '/fonts/...'.
      atlasUrl: './fonts/Ubuntu-Regular.msdf.png',
      atlasDataUrl: './fonts/Ubuntu-Regular.msdf.json',
    },
  ],
  // Register the webgl shader types Card.tsx's styles resolve to — see
  // @plextv/react-lightning's createRoot(), which maps string entries here
  // through `import('@lightningjs/renderer/webgl/shaders')` into
  // stage.shManager.registerShaderType(name, ShaderType).
  // 'Rounded' covers plain borderRadius (poster/landscape images, fallback
  // rect). 'RoundedWithBorder' is what LightningViewElement._getShaderFromStyle
  // requests when a style has BOTH borderRadius and border/borderColor (see
  // dist/LightningViewElement-*.js: `if (type === 'Rounded') type =
  // 'RoundedWithBorder'`) — used by the focus ring's two nested bordered views.
  shaders: ['Rounded', 'RoundedWithBorder'],
  // Gate 1: the RN layer. useWebWorker: false — Tizen's file:// origin can't
  // spawn the YogaManagerWorker (blob/module worker loading is unreliable
  // over file://), so flex layout runs on the main thread instead.
  plugins: getReactNativePlugins([], { flexbox: { useWebWorker: false } }),
};

const appElement = document.getElementById('app');

if (!appElement) {
  throw new Error('No app element found');
}

createRoot(appElement).render(
  <NativeCanvas keyMap={keyMap} options={options}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </NativeCanvas>,
);
