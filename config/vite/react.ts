import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type UserConfig } from 'vite'

export function defineLolarrReactConfig(config: UserConfig = {}) {
  const { plugins = [], server, ...rest } = config

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
        ...plugins,
      ],
    }
  })
}
