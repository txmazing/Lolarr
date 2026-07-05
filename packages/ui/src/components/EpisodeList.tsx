import type { Episode } from '@lolarr/domain'
import type { ActionComponent } from './types'

function progressPercent(episode: Episode): number | null {
  if (!episode.resumePositionTicks || !episode.runtimeMinutes) return null
  const runtimeTicks = episode.runtimeMinutes * 60 * 10_000_000
  if (runtimeTicks <= 0) return null
  const percent = (episode.resumePositionTicks / runtimeTicks) * 100
  return Math.min(100, Math.max(0, percent))
}

export function EpisodeList({
  episodes,
  Action,
  onPlay,
}: {
  episodes: Episode[]
  Action?: ActionComponent
  onPlay?: (episode: Episode) => void
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-5 gap-y-6">
      {episodes.map((episode) => {
        const progress = progressPercent(episode)
        const content = (
          <>
            <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-surface ring-1 ring-inset ring-white/[0.06] shadow-[inset_0_0_3px_rgb(200_200_200/0.35)] transition-[box-shadow] duration-200 group-hover:ring-2 group-hover:ring-white/30 focused:ring-2 focused:ring-white/30">
              <span className="flex h-full items-center justify-center p-3 text-center text-2xl font-semibold text-muted-foreground">
                {episode.episodeNumber}
              </span>
              {progress !== null ? (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40" aria-hidden="true">
                  <span className="block h-full bg-primary" style={{ width: `${progress}%` }} />
                </span>
              ) : null}
            </span>
            <span className="mt-2 flex w-full items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">
                {episode.title}
                {episode.played ? (
                  <span className="text-status-available" aria-label="Watched">
                    {' '}
                    ✓
                  </span>
                ) : null}
              </span>
              {episode.runtimeMinutes ? (
                <span className="shrink-0 text-xs font-light text-muted-foreground">
                  {episode.runtimeMinutes} min
                </span>
              ) : null}
            </span>
            <span className="block text-xs font-light text-muted-foreground">
              Folge {episode.episodeNumber}
            </span>
          </>
        )

        return (
          <li key={episode.id}>
            {Action && onPlay ? (
              <Action
                onPress={() => onPlay(episode)}
                focusKey={`episode-play-${episode.id}`}
                ariaLabel={`Play ${episode.title}`}
                variant="card"
                className="group block w-full text-left"
              >
                {content}
              </Action>
            ) : (
              <div className="block w-full text-left">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
