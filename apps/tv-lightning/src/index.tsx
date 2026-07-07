import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Canvas, type RenderOptions } from '@plextv/react-lightning';

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
};

const appElement = document.getElementById('app');

if (!appElement) {
  throw new Error('No app element found');
}

createRoot(appElement).render(
  <Canvas keyMap={keyMap} options={options}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </Canvas>,
);
