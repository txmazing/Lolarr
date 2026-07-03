import type { ActionComponent } from './types'

type QuickConnectPanelProps = {
  Action: ActionComponent
  code?: string
  error?: string
  onCancel: () => void
}

export function QuickConnectPanel({ Action, code, error, onCancel }: QuickConnectPanelProps) {
  return (
    <section className="panel quick-connect-panel">
      <h2>Quick Connect</h2>
      {error ? <p className="error-text">{error}</p> : null}
      {code ? (
        <>
          <p>Open the Jellyfin app on your phone and enter this code:</p>
          <p className="quick-connect-code">{code}</p>
          <p>Waiting for approval…</p>
        </>
      ) : (
        <p>Requesting code…</p>
      )}
      <Action onPress={onCancel} focusKey="qc-cancel">
        Back to password login
      </Action>
    </section>
  )
}
