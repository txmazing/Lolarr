import type { Episode } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { Check } from '../lib/icons'

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
  stillUrl,
}: {
  episodes: Episode[]
  Action?: ActionComponent
  onPlay?: (episode: Episode) => void
  // Optional resolver for the episode still image (Jellyfin Primary). When it
  // returns undefined the thumbnail falls back to a clean surface swatch.
  stillUrl?: (episode: Episode) => string | undefined
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-5 gap-y-6">
      {episodes.map((episode) => {
        const progress = progressPercent(episode)
        const still = stillUrl?.(episode)
        const content = (
          <>
            {/* Whole-card focus target: crisp near-white outline on hover (web)
                and focus (TV), reacting to `.focused` on the outer group. */}
            <span className="lolarr-art relative block aspect-video w-full overflow-hidden rounded-md bg-surface">
              {still ? (
                <img src={still} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : null}
              {progress !== null ? (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40" aria-hidden="true">
                  <span className="block h-full bg-primary" style={{ width: `${progress}%` }} />
                </span>
              ) : null}
            </span>
            <span className="mt-3 flex items-start justify-between gap-3.5">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{episode.title}</span>
                  {episode.played ? (
                    <Check className="size-3.5 shrink-0 text-status-available" aria-label="Gesehen" />
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-foreground/40">Folge {episode.episodeNumber}</span>
              </span>
              {episode.runtimeMinutes ? (
                <span className="shrink-0 pt-px text-xs text-foreground/40">
                  {episode.runtimeMinutes} Min
                </span>
              ) : null}
            </span>
          </>
        )

        return (
          <li key={episode.id}>
            {Action && onPlay ? (
              <Action
                onPress={() => onPlay(episode)}
                focusKey={`episode-play-${episode.id}`}
                ariaLabel={`${episode.title} abspielen`}
                variant="card"
                className="group block w-full text-left transition-transform duration-[370ms] ease-out-expo hover:scale-[1.03] focused:scale-[1.03] focused:bg-transparent"
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
