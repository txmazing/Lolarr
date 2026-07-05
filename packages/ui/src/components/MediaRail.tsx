import type { MediaItem } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { MediaPosterButton } from './MediaPosterButton'

type MediaRailProps = {
  id: string
  title: string
  items: MediaItem[]
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}

export function MediaRail({ id, title, items, onOpen, Action }: MediaRailProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between px-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} titles</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <MediaPosterButton
            key={item.id}
            item={item}
            onOpen={onOpen}
            Action={Action}
            focusKeyPrefix={id}
          />
        ))}
      </div>
    </section>
  )
}
