import { DefaultAction } from '../DefaultAction'
import type { ActionComponent } from '../types'
import { cn } from '@ui/lib/utils'

export function PillTabs({
  items,
  selectedId,
  onSelect,
  Action = DefaultAction,
  ariaLabel,
}: {
  items: Array<{ id: string; label: string }>
  selectedId: string
  onSelect: (id: string) => void
  Action?: ActionComponent
  ariaLabel?: string
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Action
          key={item.id}
          focusKey={`tab-${item.id}`}
          onPress={() => onSelect(item.id)}
          className={cn(
            'rounded-full px-5 h-9 text-sm',
            item.id === selectedId
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface text-muted-foreground',
          )}
        >
          {item.label}
        </Action>
      ))}
    </nav>
  )
}
