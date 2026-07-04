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

  it('renders a play action per episode and reports the episode on press', () => {
    const onPlay = vi.fn()
    render(<EpisodeList episodes={episodes} Action={Action} onPlay={onPlay} />)

    fireEvent.click(screen.getByLabelText('Play The Second One'))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledWith(episodes[1])
  })

  it('renders no play actions without Action and onPlay', () => {
    render(<EpisodeList episodes={episodes} />)
    expect(screen.queryByLabelText('Play Pilot')).toBeNull()
    expect(screen.getByText('Pilot')).toBeDefined()
  })
})
