import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/theme.css', import.meta.url)), 'utf8')

describe('design tokens', () => {
  it('defines the control + dialog tokens', () => {
    expect(css).toContain('--control-hover: rgb(255 255 255 / 0.1)')
    expect(css).toContain('--primary-solid: rgb(255 255 255 / 0.95)')
    expect(css).toContain('--dialog-frost: rgb(42 42 42 / 0.72)')
    expect(css).toContain('--blur-controls: 8px')
  })
})
