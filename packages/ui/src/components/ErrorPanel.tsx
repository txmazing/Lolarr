import type { ActionComponent } from './types'

export function ErrorPanel({
  message,
  Action,
  onRetry,
}: {
  message: string
  Action?: ActionComponent
  onRetry?: () => void
}) {
  return (
    <section className="error-panel">
      <p className="eyebrow">Gateway</p>
      <h2>Something failed.</h2>
      <p>{message}</p>
      {Action && onRetry ? (
        <Action className="ghost-action" onPress={onRetry} focusKey="error-retry">
          Retry
        </Action>
      ) : null}
    </section>
  )
}
