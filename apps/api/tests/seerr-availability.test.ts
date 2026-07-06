import { describe, expect, it } from 'vitest'
import { mapSeerrAvailability } from '../src/adapters/seerr.js'

describe('mapSeerrAvailability', () => {
  it.each([
    [undefined, 'requestable'],
    [1, 'requestable'],
    [2, 'requested'],
    [3, 'processing'],
    [4, 'partiallyAvailable'],
    [5, 'available'],
    [6, 'unavailable'],
    [7, 'requestable'],
  ] as const)('maps status %s to %s', (status, expected) => {
    expect(mapSeerrAvailability(status)).toBe(expected)
  })
})
