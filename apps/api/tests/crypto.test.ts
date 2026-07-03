import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, hashValue } from '../src/services/crypto.js'

describe('crypto', () => {
  it('round-trips encrypted text', () => {
    const secret = 'test-secret-at-least-16-chars'
    expect(decryptText(encryptText('hello', secret), secret)).toBe('hello')
  })

  it('produces unique ciphertexts per call (random iv)', () => {
    const secret = 'test-secret-at-least-16-chars'
    expect(encryptText('hello', secret)).not.toBe(encryptText('hello', secret))
  })

  it('fails to decrypt with a different secret', () => {
    const encrypted = encryptText('hello', 'secret-number-one-16')
    expect(() => decryptText(encrypted, 'secret-number-two-16')).toThrow()
  })

  it('hashes deterministically', () => {
    expect(hashValue('abc')).toBe(hashValue('abc'))
    expect(hashValue('abc')).not.toBe(hashValue('abd'))
  })
})
