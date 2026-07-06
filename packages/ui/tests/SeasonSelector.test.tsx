// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SeasonSelector } from '@ui/components/SeasonSelector'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const seasons = [
  { id: 's1', name: 'Season 1' },
  { id: 's2', name: 'Season 2' },
]

describe('SeasonSelector', () => {
  it('marks the active season chip solid, following the tab rule', () => {
    render(
      <SeasonSelector Action={DefaultAction} seasons={seasons} selectedId="s1" onSelect={() => {}} />,
    )

    const active = screen.getByRole('button', { name: 'Season 1' })
    expect(active.className).toContain('bg-primary-solid')
    expect(active.className).toContain('text-background')
  })

  it('renders inactive chips as bare text, no fill', () => {
    render(
      <SeasonSelector Action={DefaultAction} seasons={seasons} selectedId="s1" onSelect={() => {}} />,
    )

    const inactive = screen.getByRole('button', { name: 'Season 2' })
    expect(inactive.className).not.toContain('bg-primary-solid')
    expect(inactive.className).toContain('text-muted-foreground')
  })

  it('calls onSelect with the pressed season id', () => {
    const onSelect = vi.fn()
    render(
      <SeasonSelector Action={DefaultAction} seasons={seasons} selectedId="s1" onSelect={onSelect} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Season 2' }))
    expect(onSelect).toHaveBeenCalledWith('s2')
  })

  it('marks requested seasons without changing the active state', () => {
    render(
      <SeasonSelector
        Action={DefaultAction}
        seasons={seasons}
        selectedId="s1"
        onSelect={() => {}}
        requestedIds={['s2']}
      />,
    )

    expect(screen.getByLabelText('Requested')).toBeDefined()
  })
})
