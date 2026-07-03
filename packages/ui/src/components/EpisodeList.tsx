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
    <ol className="episode-list">
      {episodes.map((episode) => (
        <li key={episode.id} className="episode-row">
          {Action && onPlay ? (
            <Action
              onPress={() => onPlay(episode)}
              focusKey={`episode-play-${episode.id}`}
              ariaLabel={`Play ${episode.title}`}
              className="episode-play"
            >
              ▶
            </Action>
          ) : null}
          <span className="episode-number">{episode.episodeNumber}</span>
          <span className="episode-info">
            <span className="episode-title">
              {episode.title}
              {episode.played ? <span className="episode-played" aria-label="Watched"> ✓</span> : null}
            </span>
            {episode.overview ? <span className="episode-overview">{episode.overview}</span> : null}
          </span>
          {episode.runtimeMinutes ? (
            <span className="episode-runtime">{episode.runtimeMinutes} min</span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
