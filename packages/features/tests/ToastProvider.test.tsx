// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '../src/notifications/ToastProvider.js'

function Trigger() {
  const { show } = useToast()
  return (
    <button onClick={() => show({ kind: 'available', title: 'Dune' })}>notify</button>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows a toast on show() and auto-dismisses it after 5s', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getByText('Dune is now available')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByText('Dune is now available')).toBeNull()
  })
})
