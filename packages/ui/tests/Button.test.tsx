// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '../src/components/ui/Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders primary variant with primary classes', () => {
    render(<Button variant="primary">Play</Button>)
    const button = screen.getByRole('button', { name: 'Play' })
    expect(button.className).toContain('bg-primary')
  })

  it('appends the focused class for TV focus styling', () => {
    render(<Button className="focused">Play</Button>)
    expect(screen.getByRole('button').className).toContain('focused')
  })

  it('renders glass variant with glass-controls utility', () => {
    render(<Button variant="glass">Info</Button>)
    expect(screen.getByRole('button').className).toContain('glass-controls')
  })
})
