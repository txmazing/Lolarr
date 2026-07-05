import type { ReactNode } from 'react'
import { Search, Settings, User } from '@ui/lib/icons'
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
  onOpenSearch?: () => void
  userName?: string
  onSignOut?: () => void
  Action: ActionComponent
}

export function AppFrame({
  children,
  navItems,
  onConfigureGateway,
  onOpenSearch,
  onSignOut,
  Action,
}: AppFrameProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Fixed, background-less header floating over the full-bleed content. The
          primary nav is a centred row of bare tabs (see NavTabs); the tools on
          the right are bare icon buttons (transparent + own backdrop blur,
          hover-fill) — Suche lives here as an icon, not a tab. */}
      <header className="fixed top-0 inset-x-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center px-10 py-[18px]">
        <span className="justify-self-start flex items-center gap-2.5 text-base font-semibold tracking-[0.18em] select-none">
          LOLARR
        </span>

        {navItems && navItems.length > 0 ? (
          <NavTabs
            Action={Action}
            ariaLabel="Hauptnavigation"
            className="justify-self-center"
            items={navItems}
          />
        ) : (
          <span />
        )}

        <div className="justify-self-end flex items-center gap-2">
          <Action
            variant="ghost"
            focusKey="nav-search"
            onPress={onOpenSearch}
            ariaLabel="Suche"
            className="h-[41px] w-[41px] p-0 backdrop-blur-[8px]"
          >
            <Search className="size-5" aria-hidden />
          </Action>
          {onConfigureGateway ? (
            <Action
              variant="ghost"
              focusKey="configure-gateway"
              onPress={onConfigureGateway}
              ariaLabel="Gateway"
              className="h-[41px] w-[41px] p-0 backdrop-blur-[8px]"
            >
              <Settings className="size-5" aria-hidden />
            </Action>
          ) : null}
          <Action
            variant="ghost"
            focusKey="nav-profile"
            onPress={onSignOut}
            ariaLabel="Profil"
            className="h-[41px] w-[41px] p-0 backdrop-blur-[8px]"
          >
            <User className="size-5" aria-hidden />
          </Action>
        </div>
      </header>
      <main className="pt-24">{children}</main>
    </div>
  )
}
