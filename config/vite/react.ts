import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type UserConfig } from 'vite'

const uiSrc = fileURLToPath(new URL('../../packages/ui/src', import.meta.url))

export function defineLolarrReactConfig(config: UserConfig = {}) {
  const { plugins = [], server, resolve, ...rest } = config

  return defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
      base: './',
      ...rest,
      define: {
        __LOLARR_API_URL__: JSON.stringify(
          process.env.VITE_LOLARR_API_URL ?? env.VITE_LOLARR_API_URL ?? '',
        ),
        ...rest.define,
      },
      resolve: {
        alias: { '@ui': uiSrc },
        ...resolve,
      },
      server: {
        proxy: {
          '/api': 'http://localhost:4000',
          '/health': 'http://localhost:4000',
        },
        ...server,
      },
      plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
        ...plugins,
      ],
    }
  })
}
