// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBadge } from '../src/components/StatusBadge'

afterEach(cleanup)

describe('StatusBadge', () => {
  it.each([
    ['available', 'Available', 'text-status-available'],
    ['partiallyAvailable', 'Partially available', 'text-status-available'],
    ['processing', 'Processing', 'text-status-processing'],
    ['requested', 'Requested', 'text-status-requested'],
    ['requestable', 'Requestable', 'text-muted-foreground'],
    ['unavailable', 'Unavailable', 'text-muted-foreground'],
  ] as const)('renders %s as "%s" with %s', (availability, label, tokenClass) => {
    render(<StatusBadge availability={availability} />)
    expect(screen.getByText(label).className).toContain(tokenClass)
  })
})
