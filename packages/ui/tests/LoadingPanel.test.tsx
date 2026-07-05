// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LoadingPanel } from '../src/components/LoadingPanel'

afterEach(cleanup)

describe('LoadingPanel', () => {
  it('renders a labelled loading region', () => {
    render(<LoadingPanel />)
    expect(screen.getByRole('region', { name: 'Loading' })).toBeDefined()
    expect(screen.getByText('Loading Lolarr')).toBeDefined()
  })

  it('renders skeleton placeholders instead of a spinner', () => {
    const { container } = render(<LoadingPanel />)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.loader-line')).toBeNull()
  })
})
