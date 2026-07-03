import type { ActionComponent, TextInputComponent } from './types'

type LoginPanelProps = {
  Action: ActionComponent
  error?: string
  TextInput: TextInputComponent
  isLoading?: boolean
}

export function LoginPanel({
  Action,
  error,
  isLoading,
  TextInput,
}: LoginPanelProps) {
  return (
    <section className="login-panel">
      <div>
        <p className="eyebrow">Jellyfin login</p>
        <h2>One account for your library and requests.</h2>
        <p>
          Use your Jellyfin credentials. Lolarr keeps the session in its gateway
          and uses Seerr server-side for discovery and requests.
        </p>
      </div>
      <div className="login-fields">
        <label>
          Server user
          <TextInput
            autoComplete="username"
            enterKeyHint="next"
            focusKey="login-username"
            name="username"
            nextFocusKey="login-password"
            required
          />
        </label>
        <label>
          Password
          <TextInput
            autoComplete="current-password"
            enterKeyHint="done"
            focusKey="login-password"
            name="password"
            required
            submitOnEnter
            type="password"
          />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <Action
        className="primary-action"
        disabled={isLoading}
        focusKey="login-submit"
        type="submit"
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Action>
    </section>
  )
}
