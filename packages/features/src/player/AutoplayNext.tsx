import { useEffect, useMemo, useState } from 'react'
import { getNextUpEpisode, readJellyfinSession, type NextUpEpisode } from '@lolarr/jellyfin'
import { AutoplayOverlay, type ActionComponent } from '@lolarr/ui'
import type { KeyValueStorage } from '../storage.js'

const COUNTDOWN_SECONDS = 10

export function AutoplayNext({
  Action,
  storage,
  seriesId,
  onPlayNext,
  onDone,
}: {
  Action: ActionComponent
  storage: KeyValueStorage
  seriesId: string
  onPlayNext: (itemId: string, title?: string) => void
  onDone: () => void
}) {
  const session = useMemo(() => readJellyfinSession(storage), [storage])
  const [next, setNext] = useState<NextUpEpisode | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (!session) {
      onDone()
      return
    }
    let cancelled = false
    getNextUpEpisode(session, seriesId)
      .then((episode) => {
        if (!cancelled) {
          setNext(episode)
          if (!episode) {
            onDone()
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          onDone()
        }
      })
    return () => {
      cancelled = true
    }
  }, [session, seriesId, onDone])

  useEffect(() => {
    if (!next) {
      return
    }
    if (secondsLeft <= 0) {
      onPlayNext(next.itemId, next.title)
      return
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [next, secondsLeft, onPlayNext])

  if (!next) {
    return null
  }

  return (
    <AutoplayOverlay
      Action={Action}
      title={next.title}
      secondsLeft={secondsLeft}
      onPlayNow={() => onPlayNext(next.itemId, next.title)}
      onCancel={onDone}
    />
  )
}
