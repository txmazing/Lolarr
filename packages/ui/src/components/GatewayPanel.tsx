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
    <section className="gateway-panel">
      <div>
        <p className="eyebrow">Gateway setup</p>
        <h2>Connect this TV to Lolarr.</h2>
        <p>
          Enter the API URL from the machine running the gateway. On Tizen this
          must be an absolute network URL, for example http://192.168.1.50:4000.
        </p>
      </div>
      <div className="login-fields">
        <label>
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
      {error ? <p className="form-error">{error}</p> : null}
      <Action className="primary-action" focusKey="gateway-submit" type="submit">
        Save gateway
      </Action>
    </section>
  )
}
