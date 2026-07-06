// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBadge } from '../src/components/StatusBadge'

afterEach(cleanup)

describe('StatusBadge', () => {
  it.each([
    ['available', 'Available', 'bg-status-available'],
    ['partiallyAvailable', 'Partially available', 'bg-status-pending'],
    ['processing', 'Processing', 'bg-status-processing'],
    ['requested', 'Requested', 'bg-status-requested'],
    ['requestable', 'Requestable', 'bg-muted-foreground'],
    ['unavailable', 'Unavailable', 'bg-muted-foreground'],
  ] as const)('renders %s as "%s" with a %s dot', (availability, label, dotClass) => {
    render(<StatusBadge availability={availability} />)

    const chip = screen.getByText(label).closest('span')!
    expect(chip.className).toContain('backdrop-blur')
    expect(chip.className).not.toContain('border')
    expect(chip.className).not.toContain('bg-')

    const dot = chip.querySelector('span')!
    expect(dot.className).toContain('rounded-full')
    expect(dot.className).toContain(dotClass)
  })
})
