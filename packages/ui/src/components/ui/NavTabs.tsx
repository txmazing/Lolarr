import { DefaultAction } from '../DefaultAction'
import type { ActionComponent } from '../types'
import { cn } from '@ui/lib/utils'

export type NavTabItem = { id: string; label: string; badge?: number }

// The primary navigation is a frosted-glass segmented control. It's really just
// styled buttons that switch screens, so it's built on the injected Action seam
// (DefaultAction on web, TvAction/Norigin on TV) rather than a tab primitive —
// that keeps D-pad focus working and avoids a control we'd fully restyle anyway.
export function NavTabs({
  items,
  selectedId,
  onSelect,
  Action = DefaultAction,
  ariaLabel,
  className,
}: {
  items: NavTabItem[]
  selectedId: string
  onSelect: (id: string) => void
  Action?: ActionComponent
  ariaLabel?: string
  className?: string
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'glass inline-flex items-center gap-1 rounded-full border border-white/10 p-1 shadow-[0_4px_30px_rgba(0,0,0,0.15)]',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === selectedId
        return (
          <Action
            key={item.id}
            focusKey={`nav-${item.id}`}
            variant="ghost"
            onPress={() => onSelect(item.id)}
            className={cn(
              // Pill; active = solid accent fill + near-black text; inactive text
              // is muted and only brightens on hover (no background invert).
              'h-10 rounded-full px-5 text-sm font-medium',
              active
                ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
            )}
          >
            {item.label}
            {item.badge ? (
              <span
                className={cn(
                  'nav-badge ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  active ? 'bg-background text-foreground' : 'bg-foreground text-background',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Action>
        )
      })}
    </nav>
  )
}
