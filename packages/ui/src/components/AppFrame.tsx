import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import type { ActionComponent } from './types'
import { cn } from '@ui/lib/utils'

export type NavItem = {
  key: string
  label: string
  onPress: () => void
  active?: boolean
  badge?: number
}

type AppFrameProps = {
  children: ReactNode
  navItems?: NavItem[]
  onSearch?: () => void
  onConfigureGateway?: () => void
  userName?: string
  onSignOut?: () => void
  Action: ActionComponent
}

export function AppFrame({
  children,
  navItems,
  onSearch,
  onConfigureGateway,
  userName,
  onSignOut,
  Action,
}: AppFrameProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Slim, transparent nav that floats over the full-bleed hero below it.
          The gradient keeps the wordmark/links readable over the backdrop. */}
      <header className="sticky top-0 z-40 flex items-center gap-8 px-12 py-4 bg-gradient-to-b from-background via-background/70 to-transparent">
        <span className="text-lg font-medium tracking-[0.14em] select-none">LOLARR</span>
        {navItems && navItems.length > 0 ? (
          <nav className="flex items-center gap-1" aria-label="Primary">
            {navItems.map((item) => (
              <Action
                key={item.key}
                focusKey={`nav-${item.key}`}
                variant="ghost"
                onPress={item.onPress}
                className={cn(
                  'rounded-full px-4 h-8 text-sm',
                  item.active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.label}
                {item.badge ? (
                  <span className="nav-badge ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </Action>
            ))}
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {onSearch ? (
            <Action variant="ghost" focusKey="nav-search" onPress={onSearch} ariaLabel="Suche">
              <Search className="size-4" aria-hidden />
            </Action>
          ) : null}
          {onConfigureGateway ? (
            <Action variant="ghost" focusKey="configure-gateway" onPress={onConfigureGateway}>
              Gateway
            </Action>
          ) : null}
          {userName ? (
            <>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-sm">{userName}</span>
              <Action variant="ghost" focusKey="sign-out" onPress={onSignOut}>
                Sign out
              </Action>
            </>
          ) : null}
        </div>
      </header>
      <div className="relative">{children}</div>
    </div>
  )
}
