// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RequestStatusBadge } from '../src/components/RequestStatusBadge'

afterEach(cleanup)

describe('RequestStatusBadge', () => {
  it.each([
    ['pending', 'Pending approval', 'text-status-pending'],
    ['approved', 'Approved', 'text-status-processing'],
    ['processing', 'Processing', 'text-status-processing'],
    ['available', 'Available', 'text-status-available'],
    ['declined', 'Declined', 'text-status-declined'],
    ['failed', 'Failed', 'text-status-failed'],
  ] as const)('renders %s as "%s" with %s', (status, label, tokenClass) => {
    render(<RequestStatusBadge status={status} />)
    expect(screen.getByText(label).className).toContain(tokenClass)
  })
})
