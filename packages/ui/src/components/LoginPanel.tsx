import type { ActionComponent, TextInputComponent } from "./types";

type LoginPanelProps = {
  Action: ActionComponent;
  error?: string;
  TextInput: TextInputComponent;
  isLoading?: boolean;
};

export function LoginPanel({
  Action,
  error,
  isLoading,
  TextInput,
}: LoginPanelProps) {
  return (
    <section className="mx-auto my-[12vh] w-full max-w-md glass rounded-lg border p-10 flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Jellyfin login
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          One account for your library and requests.
        </h2>
        <p className="text-sm text-muted-foreground">
          Use your Jellyfin credentials. Lolarr keeps the session in its gateway
          and uses Seerr server-side for discovery and requests.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
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
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
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
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Action
        variant="primary"
        disabled={isLoading}
        focusKey="login-submit"
        type="submit"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </Action>
    </section>
  );
}
