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
    <section className="media-rail" aria-labelledby={`${id}-title`}>
      <div className="rail-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <span>{items.length} titles</span>
      </div>
      <div className="rail-scroll">
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
