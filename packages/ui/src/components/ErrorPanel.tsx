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
    <section className="mx-auto my-[12vh] w-full max-w-md glass rounded-lg border p-10 flex flex-col gap-6">
      <p className="eyebrow">Gateway</p>
      <h2 className="text-2xl font-semibold tracking-tight">Something failed.</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      {Action && onRetry ? (
        <Action variant="ghost" onPress={onRetry} focusKey="error-retry">
          Retry
        </Action>
      ) : null}
    </section>
  )
}
