import type { ActionComponent } from './types'

type QuickConnectPanelProps = {
  Action: ActionComponent
  code?: string
  error?: string
  onCancel: () => void
}

export function QuickConnectPanel({ Action, code, error, onCancel }: QuickConnectPanelProps) {
  return (
    <section className="mx-auto my-[12vh] w-full max-w-md glass rounded-lg border p-10 flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">Quick Connect</h2>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {code ? (
        <>
          <p className="text-sm text-muted-foreground">Open the Jellyfin app on your phone and enter this code:</p>
          <p className="font-mono text-4xl tracking-[0.3em] text-center py-4">{code}</p>
          <p className="text-sm text-muted-foreground">Waiting for approval…</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Requesting code…</p>
      )}
      <Action onPress={onCancel} focusKey="qc-cancel">
        Back to password login
      </Action>
    </section>
  )
}
