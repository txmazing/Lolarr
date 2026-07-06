// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassDialog } from '../src/components/ui/GlassDialog'

afterEach(cleanup)

describe('GlassDialog', () => {
  it('renders children and title when open', () => {
    render(
      <GlassDialog open onClose={() => {}} title="Request seasons">
        <p>Body</p>
      </GlassDialog>,
    )
    expect(screen.getByText('Request seasons')).toBeDefined()
    expect(screen.getByText('Body')).toBeDefined()
  })

  it('calls onClose when dismissed via Escape', () => {
    const onClose = vi.fn()
    render(
      <GlassDialog open onClose={onClose} title="T">
        <p>Body</p>
      </GlassDialog>,
    )
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    render(
      <GlassDialog open={false} onClose={() => {}} title="T">
        <p>Body</p>
      </GlassDialog>,
    )
    expect(screen.queryByText('Body')).toBeNull()
  })

  it('renders the popup panel with the dark-frost surface', () => {
    render(
      <GlassDialog open onClose={() => {}} title="T">
        <p>Body</p>
      </GlassDialog>,
    )
    const popup = screen.getByRole('dialog')
    expect(popup.className).toContain('bg-dialog-frost')
    expect(popup.className).toContain('backdrop-blur-[20px]')
    expect(popup.className).toContain('border-dialog-border')
    expect(popup.className).toContain('rounded-lg')
    expect(popup.className).not.toContain('glass')
  })
})
