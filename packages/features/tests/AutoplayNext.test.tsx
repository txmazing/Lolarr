// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNextUpEpisode, readJellyfinSession } from '@lolarr/jellyfin'
import type { ActionComponent } from '@lolarr/ui'
import { AutoplayNext } from '../src/player/AutoplayNext.js'
import type { KeyValueStorage } from '../src/storage.js'

vi.mock('@lolarr/jellyfin', () => ({
  readJellyfinSession: vi.fn(),
  getNextUpEpisode: vi.fn(),
}))

const session = {
  url: 'https://jellyfin.example',
  accessToken: 'token',
  userId: 'user-1',
  deviceId: 'device-1',
}

const storage: KeyValueStorage = {
  get: () => null,
  set: () => {},
  remove: () => {},
}

const Action: ActionComponent = ({ onPress, ariaLabel, children }) => (
  <button onClick={onPress} aria-label={ariaLabel}>
    {children}
  </button>
)

function renderAutoplayNext() {
  const onPlayNext = vi.fn()
  const onDone = vi.fn()
  render(
    <AutoplayNext
      Action={Action}
      storage={storage}
      seriesId="series-1"
      onPlayNext={onPlayNext}
      onDone={onDone}
    />,
  )
  return { onPlayNext, onDone }
}

async function flushNextUpFetch() {
  await act(async () => {})
}

async function advanceCountdown(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
}

describe('AutoplayNext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(readJellyfinSession).mockReturnValue(session)
    vi.mocked(getNextUpEpisode).mockResolvedValue({ itemId: 'episode-2', title: 'The Next One' })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the next episode and counts down', async () => {
    renderAutoplayNext()
    await flushNextUpFetch()

    expect(screen.getByText('The Next One')).toBeDefined()
    expect(screen.getByText('Next episode in 10s')).toBeDefined()

    await advanceCountdown(3)
    expect(screen.getByText('Next episode in 7s')).toBeDefined()
  })

  it('advances exactly once when the countdown expires', async () => {
    const { onPlayNext, onDone } = renderAutoplayNext()
    await flushNextUpFetch()

    await advanceCountdown(10)
    expect(onPlayNext).toHaveBeenCalledTimes(1)
    expect(onPlayNext).toHaveBeenCalledWith('episode-2', 'The Next One')

    await advanceCountdown(5)
    expect(onPlayNext).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('advances immediately via "Play now" without waiting for the countdown', async () => {
    const { onPlayNext } = renderAutoplayNext()
    await flushNextUpFetch()

    fireEvent.click(screen.getByText('Play now'))
    expect(onPlayNext).toHaveBeenCalledTimes(1)
    expect(onPlayNext).toHaveBeenCalledWith('episode-2', 'The Next One')
  })

  it('cancels via the Cancel action without advancing', async () => {
    const { onPlayNext, onDone } = renderAutoplayNext()
    await flushNextUpFetch()

    fireEvent.click(screen.getByText('Cancel'))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onPlayNext).not.toHaveBeenCalled()
  })

  it('falls back to onDone when there is no next episode', async () => {
    vi.mocked(getNextUpEpisode).mockResolvedValue(null)
    const { onPlayNext, onDone } = renderAutoplayNext()
    await flushNextUpFetch()

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onPlayNext).not.toHaveBeenCalled()
    expect(screen.queryByText('Play now')).toBeNull()
  })

  it('falls back to onDone when the next-up request fails', async () => {
    vi.mocked(getNextUpEpisode).mockRejectedValue(new Error('network down'))
    const { onPlayNext, onDone } = renderAutoplayNext()
    await flushNextUpFetch()

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onPlayNext).not.toHaveBeenCalled()
  })

  it('falls back to onDone when there is no Jellyfin session', async () => {
    vi.mocked(readJellyfinSession).mockReturnValue(null)
    const { onPlayNext, onDone } = renderAutoplayNext()
    await flushNextUpFetch()

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(getNextUpEpisode).not.toHaveBeenCalled()
    expect(onPlayNext).not.toHaveBeenCalled()
  })
})
