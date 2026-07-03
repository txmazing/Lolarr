import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'

export function defineLolarrReactConfig(config: UserConfig = {}) {
  const { plugins = [], ...rest } = config

  return defineConfig({
    base: './',
    ...rest,
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      ...plugins,
    ],
  })
}
