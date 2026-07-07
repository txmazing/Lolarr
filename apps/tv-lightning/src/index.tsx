import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Canvas, type RenderOptions } from '@plextv/react-lightning';

import { App } from './App';
import { keyMap } from './keyMap';

const queryClient = new QueryClient();

const options: RenderOptions = {
  fonts: [
    {
      type: 'sdf',
      fontFamily: 'sans-serif',
      atlasUrl: '/fonts/Ubuntu-Regular.msdf.png',
      atlasDataUrl: '/fonts/Ubuntu-Regular.msdf.json',
    },
  ],
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
