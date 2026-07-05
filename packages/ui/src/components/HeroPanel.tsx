import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { Badge } from '@ui/components/ui/shadcn/badge'
import { StatusBadge } from './StatusBadge'

type HeroProps = {
  item?: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}

export function HeroPanel({ item, onOpen, Action }: HeroProps) {
  if (!item) {
    return (
      <section className="relative min-h-[62vh] rounded-lg overflow-hidden flex items-end">
        <div className="relative z-10 max-w-xl p-12 flex flex-col gap-4">
          <p className="eyebrow">Discover</p>
          <h2 className="text-5xl font-semibold tracking-tight">Loading your next title...</h2>
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-[62vh] rounded-lg overflow-hidden flex items-end">
      {item.backdropUrl ? (
        <img src={item.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
      <div className="relative z-10 max-w-xl p-12 flex flex-col gap-4">
        {item.jellyfin?.progressPercent !== undefined || item.jellyfin?.episode ? (
          <Badge className="w-fit">Continue watching</Badge>
        ) : null}
        <StatusBadge availability={item.availability} />
        <h2 className="text-5xl font-semibold tracking-tight">{item.title}</h2>
        {item.jellyfin?.episode ? (
          <p className="block text-xs text-muted-foreground mt-1">
            {`${item.jellyfin.episode.seriesTitle} · S${item.jellyfin.episode.season} · E${item.jellyfin.episode.number}`}
          </p>
        ) : null}
        <p className="text-base text-muted-foreground line-clamp-3">{item.overview}</p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {item.year ? <span>{item.year}</span> : null}
          <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
        </div>
        <Action variant="primary" onPress={() => onOpen(item)} focusKey="hero">
          Open details
        </Action>
      </div>
    </section>
  )
}
