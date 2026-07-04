import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const validEnv = {
  JELLYFIN_URL: 'http://jellyfin.test',
  SEERR_URL: 'http://seerr.test',
  SEERR_API_KEY: 'test-api-key',
  LOLARR_SECRET: 'test-secret-at-least-16-chars',
  LOLARR_WEBHOOK_SECRET: 'test-webhook-secret-1234',
}

describe('loadConfig', () => {
  it('accepts a complete environment', () => {
    const config = loadConfig(validEnv)
    expect(config.JELLYFIN_URL).toBe('http://jellyfin.test')
  })

  it.each(['JELLYFIN_URL', 'SEERR_URL', 'SEERR_API_KEY', 'LOLARR_SECRET', 'LOLARR_WEBHOOK_SECRET'])(
    'throws when %s is missing',
    (key) => {
      const env = { ...validEnv }
      delete env[key as keyof typeof validEnv]
      expect(() => loadConfig(env)).toThrow()
    },
  )

  it('rejects short secrets', () => {
    expect(() => loadConfig({ ...validEnv, LOLARR_SECRET: 'short' })).toThrow()
  })

  it('leaves the cors origin unset by default', () => {
    expect(loadConfig(validEnv).LOLARR_CORS_ORIGIN).toBeUndefined()
  })

  it('accepts a cors origin list', () => {
    const config = loadConfig({ ...validEnv, LOLARR_CORS_ORIGIN: 'http://tv.local,https://lolarr.example' })
    expect(config.LOLARR_CORS_ORIGIN).toBe('http://tv.local,https://lolarr.example')
  })
})
