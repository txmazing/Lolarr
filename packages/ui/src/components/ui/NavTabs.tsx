import { DefaultAction } from '../DefaultAction'
import type { ActionComponent } from '../types'
import { cn } from '@ui/lib/utils'

export type NavTabItem = {
  key: string
  label: string
  onPress: () => void
  active?: boolean
  badge?: number
}

// The primary navigation is a row of bare tabs — no capsule container, no glass
// fill. It's really just styled buttons that switch screens, so it's built on
// the injected Action seam (DefaultAction on web, TvAction/Norigin on TV)
// rather than a tab primitive — that keeps D-pad focus working and avoids a
// control we'd fully restyle anyway.
export function NavTabs({
  items,
  Action = DefaultAction,
  ariaLabel,
  className,
}: {
  items: NavTabItem[]
  Action?: ActionComponent
  ariaLabel?: string
  className?: string
}) {
  return (
    <nav aria-label={ariaLabel} className={cn('inline-flex items-center gap-1', className)}>
      {items.map((item) => (
        <Action
          key={item.key}
          variant="ghost"
          onPress={item.onPress}
          focusKey={`nav-${item.key}`}
          className={cn(
            'h-9 rounded-[9px] px-4 text-sm font-medium backdrop-blur-[8px]',
            item.active
              ? 'bg-primary-solid text-background font-semibold'
              : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
          )}
        >
          {item.label}
          {item.badge ? (
            <span className="nav-badge ml-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-[7px] bg-surface-chip px-1.5 text-[11px] font-semibold">
              {item.badge}
            </span>
          ) : null}
        </Action>
      ))}
    </nav>
  )
}
