import { useEffect, useRef, useState } from 'react'
import { readJellyfinSession } from '@lolarr/jellyfin'
import {
  createPlaybackSession,
  WebPlayer,
  type PlaybackSessionHandle,
  type PlaybackSessionState,
} from '@lolarr/player'
import type { KeyValueStorage } from '../storage.js'

export function usePlaybackSession({
  storage,
  itemId,
  resumeTicks,
}: {
  storage: KeyValueStorage
  itemId: string
  resumeTicks?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<PlaybackSessionHandle | null>(null)
  const [state, setState] = useState<PlaybackSessionState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    const jellyfinSession = readJellyfinSession(storage)
    const video = videoRef.current
    if (!jellyfinSession || !video) {
      setState('error')
      setErrorMessage(jellyfinSession ? 'Player unavailable' : 'Session missing — please sign in again')
      return
    }

    const player = new WebPlayer(video)
    const handle = createPlaybackSession({
      session: jellyfinSession,
      player,
      itemId,
      resumeTicks,
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
  }, [storage, itemId, resumeTicks])

  return { videoRef, state, errorMessage, handle: handleRef }
}
