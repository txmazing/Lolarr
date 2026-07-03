import type { FormEvent } from 'react'
import type { LoginRequest } from '@lolarr/domain'
import {
  AppFrame,
  LoadingPanel,
  LoginPanel,
  type ActionComponent,
  type TextInputComponent,
} from '@lolarr/ui'

export function LoginScreen({
  Action,
  TextInput,
  isSessionLoading,
  loginError,
  isLoggingIn,
  onLogin,
  canConfigureGateway,
  onConfigureGateway,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  isSessionLoading: boolean
  loginError: string | undefined
  isLoggingIn: boolean
  onLogin: (payload: Omit<LoginRequest, 'deviceId'>) => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
}) {
  if (isSessionLoading) {
    return (
      <AppFrame
        Action={Action}
        onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
      >
        <LoadingPanel />
      </AppFrame>
    )
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') ?? '')
    const password = String(formData.get('password') ?? '')
    onLogin({ username, password })
  }

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
    >
      <form onSubmit={handleLogin}>
        <LoginPanel Action={Action} error={loginError} isLoading={isLoggingIn} TextInput={TextInput} />
      </form>
    </AppFrame>
  )
}
