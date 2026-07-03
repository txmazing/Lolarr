import type { ReactNode } from 'react'
import type { ActionComponent } from './types'

type AppFrameProps = {
  children: ReactNode
  onConfigureGateway?: () => void
  userName?: string
  onSignOut?: () => void
  Action: ActionComponent
}

export function AppFrame({
  children,
  onConfigureGateway,
  userName,
  onSignOut,
  Action,
}: AppFrameProps) {
  return (
    <main className="lolarr-app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lolarr</p>
          <h1>Watch what you have. Request what you want.</h1>
        </div>
        <nav className="topbar-actions" aria-label="Primary">
          {onConfigureGateway ? (
            <Action
              className="ghost-action"
              onPress={onConfigureGateway}
              focusKey="configure-gateway"
            >
              Gateway
            </Action>
          ) : null}
          {userName ? (
            <>
              <span className="user-chip">{userName}</span>
              <Action className="ghost-action" onPress={onSignOut} focusKey="sign-out">
                Sign out
              </Action>
            </>
          ) : null}
        </nav>
      </header>
      {children}
    </main>
  )
}
