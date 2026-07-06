// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '@lolarr/domain'
import { HeroPanel } from '@ui/components/HeroPanel'
import { DefaultAction } from '@ui/components/DefaultAction'

afterEach(cleanup)

const item = {
  id: '1',
  title: 'The Wire',
  overview: 'Baltimore, drugs, and the wire.',
  year: 2002,
  mediaType: 'tv',
  availability: 'available',
  backdropUrl: 'b.jpg',
} as unknown as MediaItem

describe('HeroPanel', () => {
  it('renders the availability chip, title, and meta row', () => {
    render(<HeroPanel item={item} onOpen={() => {}} onPlay={() => {}} Action={DefaultAction} />)

    expect(screen.getByText('The Wire')).toBeDefined()
    expect(screen.getByText('Available')).toBeDefined()
    expect(screen.getByText('2002')).toBeDefined()
  })

  it('renders Abspielen as the solid primary CTA', () => {
    render(<HeroPanel item={item} onOpen={() => {}} onPlay={() => {}} Action={DefaultAction} />)

    const play = screen.getByRole('button', { name: 'Abspielen' })
    expect(play.className).toContain('bg-primary-solid')
  })

  it('renders Mehr Infos as a bare (non-filled) action', () => {
    render(<HeroPanel item={item} onOpen={() => {}} onPlay={() => {}} Action={DefaultAction} />)

    const moreInfo = screen.getByRole('button', { name: 'Mehr Infos' })
    expect(moreInfo.className).not.toContain('bg-primary-solid')
    expect(moreInfo.className).toContain('bg-transparent')
  })

  it('fires onPlay from Play and onOpen from Mehr Infos independently', () => {
    const onOpen = vi.fn()
    const onPlay = vi.fn()
    render(<HeroPanel item={item} onOpen={onOpen} onPlay={onPlay} Action={DefaultAction} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(onPlay).toHaveBeenCalledWith(item)
    expect(onOpen).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Mehr Infos' }))
    expect(onOpen).toHaveBeenCalledWith(item)
  })

  it('markiert den Hero-Wrapper als Scroll-Region (ganzer Hero bei Fokus)', () => {
    const { container } = render(
      <HeroPanel item={item} onOpen={() => {}} onPlay={() => {}} Action={DefaultAction} />,
    )
    expect(container.querySelector('[data-focus-scroll-region]')).toBeTruthy()
  })
})
