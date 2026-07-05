import type { ActionComponent, TextInputComponent } from './types'

type GatewayPanelProps = {
  Action: ActionComponent
  defaultUrl?: string
  error?: string
  TextInput: TextInputComponent
}

export function GatewayPanel({
  Action,
  defaultUrl,
  error,
  TextInput,
}: GatewayPanelProps) {
  return (
    <section className="mx-auto my-[12vh] w-full max-w-md glass rounded-lg border p-10 flex flex-col gap-6">
      <div>
        <p className="eyebrow">Gateway setup</p>
        <h2 className="text-2xl font-semibold tracking-tight">Connect this TV to Lolarr.</h2>
        <p className="text-sm text-muted-foreground">
          Enter the API URL from the machine running the gateway. On Tizen this
          must be an absolute network URL, for example http://192.168.1.50:4000.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Gateway URL
          <TextInput
            autoComplete="off"
            defaultValue={defaultUrl}
            enterKeyHint="done"
            focusKey="gateway-api-url"
            name="apiUrl"
            placeholder="http://192.168.1.50:4000"
            required
            submitOnEnter
          />
        </label>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Action variant="primary" focusKey="gateway-submit" type="submit">
        Save gateway
      </Action>
    </section>
  )
}
