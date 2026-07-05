// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Episode } from '@lolarr/domain'
import { EpisodeList } from '../src/components/EpisodeList.js'
import type { ActionComponent } from '../src/components/types.js'

const Action: ActionComponent = ({ onPress, ariaLabel, children }) => (
  <button onClick={onPress} aria-label={ariaLabel}>
    {children}
  </button>
)

const episodes: Episode[] = [
  {
    id: 'ep-1',
    jellyfinItemId: 'jf-ep-1',
    title: 'Pilot',
    seasonNumber: 1,
    episodeNumber: 1,
    overview: 'The one that starts it all',
    runtimeMinutes: 42,
    played: true,
  },
  {
    id: 'ep-2',
    jellyfinItemId: 'jf-ep-2',
    title: 'The Second One',
    seasonNumber: 1,
    episodeNumber: 2,
    overview: '',
    played: false,
  },
]

describe('EpisodeList', () => {
  afterEach(cleanup)

  it('renders a responsive grid container', () => {
    const { container } = render(<EpisodeList episodes={episodes} Action={Action} onPlay={vi.fn()} />)
    expect(container.querySelector('[class*="grid-cols"]')).toBeTruthy()
  })

  it('renders exactly one focusable card per episode and reports the episode on press', () => {
    const onPlay = vi.fn()
    render(<EpisodeList episodes={episodes} Action={Action} onPlay={onPlay} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(episodes.length)

    fireEvent.click(screen.getByLabelText('Play The Second One'))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledWith(episodes[1])
  })

  it('shows the episode caption with title, "Folge N", and runtime, with the whole card as the only focus target', () => {
    render(<EpisodeList episodes={episodes} Action={Action} onPlay={vi.fn()} />)

    expect(screen.getByText('Pilot')).toBeDefined()
    expect(screen.getByText('Folge 1')).toBeDefined()
    expect(screen.getByText('42 min')).toBeDefined()
    // The whole card is the single focusable/playable action — no separate
    // play glyph or nested button inside it.
    expect(screen.queryByText('▶')).toBeNull()
    expect(screen.getByLabelText('Play Pilot').querySelector('button')).toBeNull()
  })

  it('renders no play actions without Action and onPlay', () => {
    render(<EpisodeList episodes={episodes} />)
    expect(screen.queryByLabelText('Play Pilot')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Pilot')).toBeDefined()
  })
})
