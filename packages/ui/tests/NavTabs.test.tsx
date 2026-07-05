// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NavTabs } from '@ui/components/ui/NavTabs'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const items = [
  { key: 'home', label: 'Start', onPress: () => {}, active: true },
  { key: 'req', label: 'Anfragen', onPress: () => {}, badge: 3 },
]

describe('NavTabs', () => {
  it('renders bare tabs with a solid active tab and a badge', () => {
    render(<NavTabs Action={DefaultAction} items={items} ariaLabel="Hauptnavigation" />)
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(nav.className).not.toContain('bg-') // no container fill
    const active = screen.getByText('Start').closest('button')!
    expect(active.className).toContain('bg-primary-solid')
    expect(screen.getByText('3')).toBeDefined() // badge
  })
})
