// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RequestStatusBadge } from '../src/components/RequestStatusBadge'

afterEach(cleanup)

describe('RequestStatusBadge', () => {
  it.each([
    ['pending', 'Pending approval', 'bg-status-pending'],
    ['approved', 'Approved', 'bg-status-processing'],
    ['processing', 'Processing', 'bg-status-processing'],
    ['available', 'Available', 'bg-status-available'],
    ['declined', 'Declined', 'bg-status-declined'],
    ['failed', 'Failed', 'bg-status-failed'],
  ] as const)('renders %s as a bare chip labelled "%s" with a %s dot', (status, label, dotClass) => {
    render(<RequestStatusBadge status={status} />)

    const chip = screen.getByText(label).closest('span')!
    expect(chip.className).toContain('backdrop-blur')
    expect(chip.className).not.toContain('border')
    expect(chip.className).not.toContain('bg-')
    expect(screen.getByText(label).className).toContain('text-foreground')

    const dot = chip.querySelector('span')!
    expect(dot.className).toContain('rounded-full')
    expect(dot.className).toContain(dotClass)
  })
})
