// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '@ui/components/ui/Button'

afterEach(cleanup)

describe('Button', () => {
  it('primary is a solid near-white CTA', () => {
    render(<Button variant="primary">Go</Button>)
    const c = screen.getByRole('button').className
    expect(c).toContain('bg-primary-solid')
    expect(c).toContain('text-background')
  })
  it('bare variants have no border and carry their own blur', () => {
    render(<Button variant="secondary">Back</Button>)
    const c = screen.getByRole('button').className
    expect(c).toContain('bg-transparent')
    expect(c).toContain('backdrop-blur')
    expect(c).toContain('hover:bg-control-hover')
    expect(c).not.toContain('border-border')
  })
})
