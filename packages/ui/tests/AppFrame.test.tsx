// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppFrame } from '@ui/components/AppFrame'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

describe('AppFrame', () => {
  it('has a fixed, background-less header', () => {
    render(
      <AppFrame Action={DefaultAction}>
        <div>content</div>
      </AppFrame>,
    )
    const header = screen.getByRole('banner')
    expect(header.className).toContain('fixed')
    expect(header.className).not.toContain('bg-')
  })

  it('shows search + profile icons when their handlers are provided', () => {
    render(
      <AppFrame Action={DefaultAction} onOpenSearch={() => {}} onSignOut={() => {}}>
        <div>content</div>
      </AppFrame>,
    )
    // getByLabelText throws if absent, so a truthy assertion is enough here
    // (this package has no jest-dom setup, matching the other UI tests).
    expect(screen.getByLabelText('Suche')).toBeTruthy()
    expect(screen.getByLabelText('Profil')).toBeTruthy()
  })

  it('hides search + profile icons when their handlers are absent (pre-auth screens)', () => {
    render(
      <AppFrame Action={DefaultAction}>
        <div>content</div>
      </AppFrame>,
    )
    expect(screen.queryByLabelText('Suche')).toBeNull()
    expect(screen.queryByLabelText('Profil')).toBeNull()
  })
})
