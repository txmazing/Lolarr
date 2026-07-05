// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Input } from '@ui/components/ui/Input'

afterEach(cleanup)

describe('Input', () => {
  it('is a 44px glass field', () => {
    render(<Input aria-label="q" />)
    const c = screen.getByLabelText('q').className
    expect(c).toContain('h-11')
    expect(c).toContain('backdrop-blur')
  })
})
