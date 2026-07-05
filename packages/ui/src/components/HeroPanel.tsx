import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { Badge } from '@ui/components/ui/Badge'
import { StatusBadge } from './StatusBadge'

type HeroProps = {
  item?: MediaItem
  onOpen: (item: MediaItem) => void
  // Optional: when provided, the hero renders a dedicated primary "Play" CTA
  // alongside the bare "Mehr Infos" action (which still calls onOpen). When
  // omitted, onOpen alone drives the single primary CTA (back-compat).
  onPlay?: (item: MediaItem) => void
  Action: ActionComponent
}

// Full-bleed cinematic hero. -mt-16 pulls the backdrop up under the sticky nav
// (see AppFrame) so it bleeds to the very top edge; the gradients keep the nav
// and the bottom-left content readable over the image.
const HERO_SHELL = 'relative w-full h-[82vh] min-h-[520px] overflow-hidden -mt-24'
const HERO_CONTENT = 'absolute bottom-[14%] left-0 px-12 max-w-2xl flex flex-col gap-4 z-10'

export function HeroPanel({ item, onOpen, onPlay, Action }: HeroProps) {
  if (!item) {
    return (
      <section className={HERO_SHELL}>
        <div className="absolute inset-0 bg-surface" />
        <div className={HERO_CONTENT}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Discover</p>
          <h2 className="text-5xl md:text-6xl font-semibold tracking-tight">Loading your next title...</h2>
        </div>
      </section>
    )
  }

  return (
    <section className={HERO_SHELL}>
      {item.backdropUrl ? (
        <img src={item.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-surface" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/25 to-transparent" />
      <div className={HERO_CONTENT}>
        {item.jellyfin?.progressPercent !== undefined || item.jellyfin?.episode ? (
          <Badge className="w-fit">Continue watching</Badge>
        ) : null}
        <StatusBadge availability={item.availability} />
        <h2 className="text-5xl md:text-6xl font-semibold tracking-tight">{item.title}</h2>
        {item.jellyfin?.episode ? (
          <p className="text-xs text-muted-foreground">
            {`${item.jellyfin.episode.seriesTitle} · S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`}
          </p>
        ) : null}
        <p className="text-base text-muted-foreground line-clamp-2 max-w-xl">{item.overview}</p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {item.year ? <span>{item.year}</span> : null}
          <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Action variant="primary" onPress={() => (onPlay ?? onOpen)(item)} focusKey="hero-play">
            Play
          </Action>
          {onPlay ? (
            <Action variant="ghost" onPress={() => onOpen(item)} focusKey="hero-info">
              Mehr Infos
            </Action>
          ) : null}
        </div>
      </div>
    </section>
  )
}
