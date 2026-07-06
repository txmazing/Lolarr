// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastStack, type ToastItem } from '../src/components/ToastStack.js'

const toasts: ToastItem[] = [
  { id: 'a', kind: 'available', title: 'Dune' },
  { id: 'b', kind: 'failed', title: 'Tenet' },
]

describe('ToastStack', () => {
  afterEach(cleanup)

  it('renders one message per toast with a kind-specific class', () => {
    const { container } = render(<ToastStack toasts={toasts} />)
    expect(screen.getByText('Dune is now available')).toBeDefined()
    expect(screen.getByText('Tenet failed to process')).toBeDefined()
    expect(container.querySelector('.border-l-status-available')).not.toBeNull()
    expect(container.querySelector('.border-l-status-failed')).not.toBeNull()
  })

  it('renders nothing when empty', () => {
    const { container } = render(<ToastStack toasts={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
