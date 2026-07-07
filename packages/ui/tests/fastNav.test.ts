// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFastNavTracking } from '@ui/lib/focusScroll'

let cleanup: () => void

function press(key: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
  cleanup = installFastNavTracking()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete document.documentElement.dataset.navFast
})

describe('installFastNavTracking', () => {
  it('a single arrow press does not enter fast mode', () => {
    press('ArrowRight')
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('key repeat enters fast mode immediately', () => {
    press('ArrowRight')
    press('ArrowRight', true)
    expect(document.documentElement.dataset.navFast).toBe('true')
  })

  it('two rapid presses enter fast mode', () => {
    press('ArrowRight')
    vi.advanceTimersByTime(100)
    press('ArrowRight')
    expect(document.documentElement.dataset.navFast).toBe('true')
  })

  it('slow presses never enter fast mode', () => {
    press('ArrowRight')
    vi.advanceTimersByTime(400)
    press('ArrowRight')
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('fast mode clears shortly after the last press', () => {
    press('ArrowRight')
    press('ArrowRight', true)
    expect(document.documentElement.dataset.navFast).toBe('true')
    vi.advanceTimersByTime(200)
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('held key keeps fast mode alive across repeats', () => {
    press('ArrowRight')
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(50)
      press('ArrowRight', true)
    }
    expect(document.documentElement.dataset.navFast).toBe('true')
  })

  it('non-arrow keys are ignored', () => {
    press('Enter')
    press('Enter', true)
    expect(document.documentElement.dataset.navFast).toBeUndefined()
  })

  it('cleanup removes attribute and pending timer', () => {
    press('ArrowRight')
    press('ArrowRight', true)
    cleanup()
    expect(document.documentElement.dataset.navFast).toBeUndefined()
    // Re-install so afterEach cleanup stays valid.
    cleanup = installFastNavTracking()
  })
})
