// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlayerControls } from '@ui/components/PlayerControls'
import { DefaultAction } from '@ui/components/DefaultAction'

// This package has no jest-dom setup — assert with toBeTruthy/toBeNull, matching
// the other UI tests. getByText/getByLabelText already throw when not found.
afterEach(cleanup)

function props(overrides?: Partial<Parameters<typeof PlayerControls>[0]>) {
  return {
    Action: DefaultAction,
    visible: true,
    isPaused: false,
    position: 0,
    duration: 100,
    volume: 1,
    showVolume: false,
    onTogglePause: () => {},
    onSeekTo: () => {},
    onSeekBy: () => {},
    onVolume: () => {},
    onFullscreen: () => {},
    onBack: () => {},
    ...overrides,
  } as const
}

function markup(showVolume: boolean) {
  return renderToStaticMarkup(<PlayerControls {...props({ showVolume })} />)
}

describe('PlayerControls showVolume', () => {
  it('renders the volume slider when showVolume is true', () => {
    expect(markup(true)).toContain('aria-label="Volume"')
  })

  it('omits the volume slider when showVolume is false', () => {
    expect(markup(false)).not.toContain('aria-label="Volume"')
  })
})

describe('PlayerControls layout', () => {
  it('shows the remaining time with a leading minus', () => {
    // 100s duration, 40s elapsed → 60s remaining → "-1:00"
    render(<PlayerControls {...props({ position: 40, duration: 100 })} />)
    const remaining = screen.getByText(/^-/)
    expect(remaining).toBeTruthy()
    expect(remaining.textContent).toBe('-1:00')
  })

  it('gives every control button the same uniform size class', () => {
    render(<PlayerControls {...props()} />)
    // Sample a spread of controls from both clusters + play/pause (isPaused=false → "Pause").
    for (const label of ['Pause', 'Forward 10 seconds', 'Back 10 seconds', 'Favorite', 'Fullscreen']) {
      const button = screen.getByLabelText(label)
      expect(button.className).toContain('h-11')
      expect(button.className).toContain('w-11')
      expect(button.className).toContain('p-0')
    }
  })

  it('renders no Picture-in-Picture control', () => {
    render(<PlayerControls {...props()} />)
    expect(screen.queryByLabelText(/picture.?in.?picture/i)).toBeNull()
    expect(screen.queryByLabelText(/PiP/i)).toBeNull()
  })

  it('exposes the expected aria-labels', () => {
    render(<PlayerControls {...props()} />)
    expect(screen.getByLabelText('Back')).toBeTruthy()
    expect(screen.getByLabelText('Previous')).toBeTruthy()
    expect(screen.getByLabelText('Back 10 seconds')).toBeTruthy()
    expect(screen.getByLabelText('Pause')).toBeTruthy() // isPaused=false → shows Pause
    expect(screen.getByLabelText('Forward 10 seconds')).toBeTruthy()
    expect(screen.getByLabelText('Next')).toBeTruthy()
    expect(screen.getByLabelText('Favorite')).toBeTruthy()
    expect(screen.getByLabelText('Subtitles')).toBeTruthy()
    expect(screen.getByLabelText('Audio')).toBeTruthy()
    expect(screen.getByLabelText('Settings')).toBeTruthy()
    expect(screen.getByLabelText('Fullscreen')).toBeTruthy()
  })

  it('labels the play/pause control Play when paused', () => {
    render(<PlayerControls {...props({ isPaused: true })} />)
    expect(screen.getByLabelText('Play')).toBeTruthy()
  })

  it('renders the rating star only when a rating is provided', () => {
    const { rerender } = render(<PlayerControls {...props()} />)
    expect(screen.queryByText('7.4')).toBeNull()
    rerender(<PlayerControls {...props({ rating: 7.4 })} />)
    expect(screen.getByText('7.4')).toBeTruthy()
  })

  it('renders the ends-at label from position, duration and now', () => {
    // now fixed at 12:00:00 local; 60s remaining → ends 12:01
    const now = new Date('2026-01-01T12:00:00').getTime()
    render(<PlayerControls {...props({ position: 40, duration: 100, now })} />)
    expect(screen.getByText(/Endet um 12:01/)).toBeTruthy()
  })
})
