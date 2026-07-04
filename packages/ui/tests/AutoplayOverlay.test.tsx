// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AutoplayOverlay } from '../src/components/AutoplayOverlay.js'
import type { ActionComponent } from '../src/components/types.js'

const Action: ActionComponent = ({ onPress, ariaLabel, children }) => (
  <button onClick={onPress} aria-label={ariaLabel}>
    {children}
  </button>
)

function renderOverlay(secondsLeft = 10) {
  const onPlayNow = vi.fn()
  const onCancel = vi.fn()
  render(
    <AutoplayOverlay
      Action={Action}
      title="Episode Two"
      secondsLeft={secondsLeft}
      onPlayNow={onPlayNow}
      onCancel={onCancel}
    />,
  )
  return { onPlayNow, onCancel }
}

describe('AutoplayOverlay', () => {
  afterEach(cleanup)

  it('shows the countdown and the next title', () => {
    renderOverlay(7)
    expect(screen.getByText('Next episode in 7s')).toBeDefined()
    expect(screen.getByText('Episode Two')).toBeDefined()
  })

  it('fires onPlayNow when "Play now" is pressed', () => {
    const { onPlayNow, onCancel } = renderOverlay()
    fireEvent.click(screen.getByText('Play now'))
    expect(onPlayNow).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel when "Cancel" is pressed', () => {
    const { onPlayNow, onCancel } = renderOverlay()
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onPlayNow).not.toHaveBeenCalled()
  })
})
