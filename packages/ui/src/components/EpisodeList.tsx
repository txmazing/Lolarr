import type { Episode } from '@lolarr/domain'
import type { ActionComponent } from './types'

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
    <ol className="flex flex-col gap-2">
      {episodes.map((episode) => (
        <li
          key={episode.id}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-md bg-surface p-4 transition-colors duration-[350ms] ease-out-expo ring-1 ring-inset ring-white/[0.06] hover:bg-surface-2 hover:ring-white/15 focused:bg-surface-2 focused:ring-white/15"
        >
          {Action && onPlay ? (
            <Action
              onPress={() => onPlay(episode)}
              focusKey={`episode-play-${episode.id}`}
              ariaLabel={`Play ${episode.title}`}
              variant="glass"
            >
              ▶
            </Action>
          ) : null}
          <span className="text-sm text-muted-foreground w-8">{episode.episodeNumber}</span>
          <span className="flex flex-col gap-1">
            <span>
              {episode.title}
              {episode.played ? <span className="text-status-available" aria-label="Watched"> ✓</span> : null}
            </span>
            {episode.overview ? (
              <span className="text-sm text-muted-foreground line-clamp-2">{episode.overview}</span>
            ) : null}
          </span>
          {episode.runtimeMinutes ? (
            <span className="text-xs text-muted-foreground">{episode.runtimeMinutes} min</span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
