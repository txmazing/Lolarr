import type { ActionComponent } from './types'
import { cn } from '@ui/lib/utils'

type SeasonSelectorProps = {
  Action: ActionComponent
  seasons: Array<{ id: string; name: string }>
  selectedId: string
  onSelect: (id: string) => void
  // Optional, additive: ids of seasons already requested in Seerr. Purely a
  // visual marker on the chip — does not affect selection/focus behaviour.
  requestedIds?: string[]
}

// Season chips follow the tab rule (see NavTabs): active is a solid fill,
// inactive is bare text that only picks up colour on hover/focus. No pill
// background on the resting state, so this is built inline on the injected
// Action rather than reusing PillTabs (whose resting state is filled).
export function SeasonSelector({
  Action,
  seasons,
  selectedId,
  onSelect,
  requestedIds,
}: SeasonSelectorProps) {
  return (
    <nav aria-label="Seasons" className="flex flex-wrap gap-2">
      {seasons.map((season) => {
        const isActive = season.id === selectedId
        const isRequested = requestedIds?.includes(season.id)
        return (
          <Action
            key={season.id}
            focusKey={`tab-${season.id}`}
            onPress={() => onSelect(season.id)}
            className={cn(
              'h-9 rounded-[9px] px-4 text-sm font-medium',
              isActive
                ? 'bg-primary-solid text-background font-semibold'
                : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
            )}
          >
            {season.name}
            {isRequested ? (
              <span className="text-status-requested" aria-label="Requested">
                {' '}
                •
              </span>
            ) : null}
          </Action>
        )
      })}
    </nav>
  )
}
