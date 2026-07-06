// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installModalityTracking,
  isKeyboardModality,
  scrollFocusedIntoView,
} from '@ui/lib/focusScroll'

let cleanup: () => void
let scrollSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  // rAF synchron ausführen → deterministische Assertions.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  // jsdom hat kein matchMedia; Standard: Bewegung erlaubt.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }))
  scrollSpy = vi.fn()
  Element.prototype.scrollIntoView =
    scrollSpy as unknown as typeof Element.prototype.scrollIntoView
  cleanup = installModalityTracking()
})

afterEach(() => {
  cleanup()
  // Modalität zwischen Tests auf Default (Pointer) zurücksetzen.
  window.dispatchEvent(new Event('pointerdown'))
  vi.unstubAllGlobals()
})

describe('modality tracking', () => {
  it('startet nicht-Tastatur und kippt bei keydown / zurück bei pointer', () => {
    window.dispatchEvent(new Event('pointerdown'))
    expect(isKeyboardModality()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(isKeyboardModality()).toBe(true)

    window.dispatchEvent(new Event('pointermove'))
    expect(isKeyboardModality()).toBe(false)
  })
})

describe('scrollFocusedIntoView', () => {
  it('scrollt nicht unter Pointer-Modalität', () => {
    window.dispatchEvent(new Event('pointerdown'))
    const el = document.createElement('div')
    scrollFocusedIntoView(el, { smooth: true })
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('zeigt die ganze Hero-Region oben (block:start)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    const region = document.createElement('section')
    region.setAttribute('data-focus-scroll-region', '')
    const button = document.createElement('button')
    region.appendChild(button)
    document.body.appendChild(region)

    scrollFocusedIntoView(button, { smooth: true })

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy.mock.instances[0]).toBe(region)
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
  })

  it('zentriert eine Rail-Card + horizontaler Nudge', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    const card = document.createElement('button')
    document.body.appendChild(card)

    scrollFocusedIntoView(card, { smooth: true })

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
  })

  it('instant bei prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    const card = document.createElement('button')
    document.body.appendChild(card)

    scrollFocusedIntoView(card, { smooth: true })

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'auto',
    })
  })

  it('instant wenn smooth nicht angefragt (TV)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    const card = document.createElement('button')
    document.body.appendChild(card)

    scrollFocusedIntoView(card, { smooth: false })

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'auto',
    })
  })
})
