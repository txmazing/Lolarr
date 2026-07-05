import type { ReactNode } from 'react'
import { LogOut, Settings } from 'lucide-react'
import type { ActionComponent } from './types'
import { NavTabs } from './ui/NavTabs'

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
  onConfigureGateway?: () => void
  userName?: string
  onSignOut?: () => void
  Action: ActionComponent
}

export function AppFrame({
  children,
  navItems,
  onConfigureGateway,
  userName,
  onSignOut,
  Action,
}: AppFrameProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Transparent header floating over the full-bleed hero. The primary nav
          is a centred row of bare tabs (see NavTabs); a light top scrim keeps
          the wordmark and links legible over a bright backdrop. */}
      <header className="sticky top-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center px-12 py-5 bg-gradient-to-b from-background/80 via-background/25 to-transparent">
        <span className="justify-self-start text-base font-semibold tracking-[0.2em] select-none">
          LOLARR
        </span>

        {navItems && navItems.length > 0 ? (
          <NavTabs Action={Action} ariaLabel="Primary" className="justify-self-center" items={navItems} />
        ) : (
          <span />
        )}

        <div className="flex items-center justify-self-end gap-2">
          {onConfigureGateway ? (
            <Action
              variant="ghost"
              focusKey="configure-gateway"
              onPress={onConfigureGateway}
              ariaLabel="Gateway"
              className="h-10 w-10 rounded-full p-0"
            >
              <Settings className="size-4" aria-hidden />
            </Action>
          ) : null}
          {userName ? (
            <>
              <span
                className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-sm font-medium select-none"
                aria-hidden
              >
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <Action
                variant="glass"
                focusKey="sign-out"
                onPress={onSignOut}
                ariaLabel="Abmelden"
                className="h-10 w-10 rounded-full p-0"
              >
                <LogOut className="size-4" aria-hidden />
              </Action>
            </>
          ) : null}
        </div>
      </header>
      <div className="relative">{children}</div>
    </div>
  )
}
