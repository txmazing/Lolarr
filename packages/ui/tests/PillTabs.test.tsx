// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PillTabs } from '../src/components/ui/PillTabs'

afterEach(cleanup)

const items = [
  { id: 'movies', label: 'Movies' },
  { id: 'shows', label: 'Shows' },
]

describe('PillTabs', () => {
  it('renders one action per item', () => {
    render(<PillTabs items={items} selectedId="movies" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Movies' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Shows' })).toBeDefined()
  })

  it('marks only the selected item with the primary pill classes', () => {
    render(<PillTabs items={items} selectedId="movies" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Movies' }).className).toContain('bg-primary')
    expect(screen.getByRole('button', { name: 'Shows' }).className).not.toContain('bg-primary')
  })

  it('calls onSelect with the id of a clicked item', () => {
    const onSelect = vi.fn()
    render(<PillTabs items={items} selectedId="movies" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Shows' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('shows')
  })
})
