import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { MediaPosterButton } from './MediaPosterButton'

type MediaRailProps = {
  id: string
  title: string
  items: MediaItem[]
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
  cardVariant?: 'portrait' | 'landscape'
}

export function MediaRail({ id, title, items, onOpen, Action, cardVariant }: MediaRailProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between pl-12 pr-12">
        <h2 id={`${id}-title`} className="text-lg font-medium">
          {title}
        </h2>
      </div>
      <div className="lolarr-rail flex gap-5 overflow-x-auto pl-12 pr-12 pt-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <MediaPosterButton
            key={item.id}
            item={item}
            onOpen={onOpen}
            Action={Action}
            focusKeyPrefix={id}
            variant={cardVariant}
          />
        ))}
      </div>
    </section>
  )
}
