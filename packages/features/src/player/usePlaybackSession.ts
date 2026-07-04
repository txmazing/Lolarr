import { useEffect, useRef, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  createPlaybackSession,
  type PlaybackSessionHandle,
  type PlaybackSessionState,
  type PlayerPlatform,
} from '@lolarr/player'
import type { KeyValueStorage } from '../storage.js'

export function usePlaybackSession({
  storage,
  platform,
  itemId,
  resumeTicks,
}: {
  storage: KeyValueStorage
  platform: PlayerPlatform
  itemId: string
  resumeTicks?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<PlaybackSessionHandle | null>(null)
  const [state, setState] = useState<PlaybackSessionState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    const jellyfinSession = readJellyfinSession(storage)
    const container = containerRef.current
    if (!jellyfinSession || !container) {
      setState('error')
      setErrorMessage(jellyfinSession ? 'Player unavailable' : 'Session missing — please sign in again')
      return
    }

    const player = platform.createPlayer({
      container,
      token: jellyfinSession.accessToken,
      serverUrl: jellyfinSession.url,
    })
    const handle = createPlaybackSession({
      session: jellyfinSession,
      player,
      itemId,
      resumeTicks,
      deviceProfile: platform.buildDeviceProfile(),
      onStateChange: (nextState, detail) => {
        setState(nextState)
        if (detail?.message) {
          setErrorMessage(detail.message)
        }
      },
    })
    handleRef.current = handle
    void handle.start()

    return () => {
      handleRef.current = null
      void handle.stop()
    }
  }, [storage, platform, itemId, resumeTicks])

  return { containerRef, state, errorMessage, handle: handleRef }
}
