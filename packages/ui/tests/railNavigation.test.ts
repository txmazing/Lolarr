// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installRailNavigation } from '@ui/lib/railNavigation'

let cleanup: () => void
let setFocus: ReturnType<typeof vi.fn>
let currentKey: string

// Two rails, two cards each. `currentKey` is what Norigin would report as the
// currently focused card; the tests set it before dispatching a key.
function buildDom() {
  document.body.innerHTML = `
    <div data-rail="r1">
      <button data-focus-key="r1-a"></button>
      <button data-focus-key="r1-b"></button>
    </div>
    <div data-rail="r2">
      <button data-focus-key="r2-a"></button>
      <button data-focus-key="r2-b"></button>
    </div>
  `
}

function press(key: string): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  window.dispatchEvent(ev)
  return ev
}

beforeEach(() => {
  buildDom()
  currentKey = ''
  setFocus = vi.fn((k: string) => {
    currentKey = k
  })
  cleanup = installRailNavigation({ setFocus, getCurrentFocusKey: () => currentKey })
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('installRailNavigation', () => {
  it('ArrowDown jumps to the first card of the next rail (no memory yet)', () => {
    currentKey = 'r1-a'
    const ev = press('ArrowDown')
    expect(setFocus).toHaveBeenCalledWith('r2-a')
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ArrowUp from the first rail is NOT intercepted (Norigin goes to hero/nav)', () => {
    currentKey = 'r1-a'
    const ev = press('ArrowUp')
    expect(setFocus).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('ArrowRight in the middle of a rail is NOT intercepted (Norigin moves within)', () => {
    currentKey = 'r1-a'
    const ev = press('ArrowRight')
    expect(setFocus).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('ArrowRight on the LAST card snakes forward to the next rail first card', () => {
    currentKey = 'r1-b'
    const ev = press('ArrowRight')
    expect(setFocus).toHaveBeenCalledWith('r2-a')
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ArrowRight on the last card of the LAST rail does nothing', () => {
    currentKey = 'r2-b'
    const ev = press('ArrowRight')
    expect(setFocus).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('remembers each rail and resumes it on return', () => {
    // Sit on r1-b, drop into r2 (remembers r1 -> r1-b, enters r2 at first card).
    currentKey = 'r1-b'
    press('ArrowDown')
    expect(setFocus).toHaveBeenLastCalledWith('r2-a')

    // Move within r2 to r2-b, then go back up: r1 resumes at r1-b, not r1-a.
    currentKey = 'r2-b'
    press('ArrowUp')
    expect(setFocus).toHaveBeenLastCalledWith('r1-b')
  })

  it('falls back to the first card when the remembered card no longer exists', () => {
    // Remember r2 -> r2-b by visiting it, then remove that card.
    currentKey = 'r2-b'
    press('ArrowLeft') // records r2 -> r2-b, no intercept
    document.querySelector('[data-focus-key="r2-b"]')?.remove()

    currentKey = 'r1-a'
    press('ArrowDown') // enter r2 → remembered r2-b gone → first card r2-a
    expect(setFocus).toHaveBeenLastCalledWith('r2-a')
  })

  it('does not intercept when focus is not on a rail card', () => {
    currentKey = 'hero-play' // not present in any [data-rail]
    const ev = press('ArrowDown')
    expect(setFocus).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })
})
