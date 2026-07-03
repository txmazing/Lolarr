import type { LoginRequest } from '@lolarr/domain'
import type { ActionComponent, TextInputComponent } from '@lolarr/ui'
import { DetailScreen } from './detail/DetailScreen.js'
import { HomeScreen } from './home/HomeScreen.js'
import { LoginScreen } from './auth/LoginScreen.js'
import { useAuth } from './auth/useAuth.js'
import { useCurrentScreen, useScreenStore } from './navigation/store.js'
import type { KeyValueStorage } from './storage.js'

/**
 * Renders the post-gateway experience: login, then home/detail based on the
 * current navigation screen. Lives inside the ApiProvider tree so useAuth
 * (and the screens) can call useApi().
 */
export function AuthenticatedExperience({
  Action,
  TextInput,
  storage,
  apiBaseUrl,
  token,
  setToken,
  canConfigureGateway,
  onConfigureGateway,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  storage: KeyValueStorage
  apiBaseUrl: string
  token: string | undefined
  setToken: (token: string | undefined) => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
}) {
  const auth = useAuth({ storage, apiBaseUrl, token, setToken })
  const currentScreen = useCurrentScreen()

  function handleSignOut() {
    auth.signOut()
    useScreenStore.getState().reset()
  }

  function handleLogin(payload: LoginRequest) {
    auth.login(payload)
  }

  if (!auth.user) {
    return (
      <LoginScreen
        Action={Action}
        TextInput={TextInput}
        isSessionLoading={auth.isSessionLoading}
        loginError={auth.loginError}
        isLoggingIn={auth.isLoggingIn}
        onLogin={handleLogin}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={onConfigureGateway}
      />
    )
  }

  if (currentScreen.name === 'detail') {
    return (
      <DetailScreen
        Action={Action}
        apiBaseUrl={apiBaseUrl}
        item={currentScreen.item}
        userName={auth.user.name}
        onSignOut={handleSignOut}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={onConfigureGateway}
        onBack={() => useScreenStore.getState().pop()}
      />
    )
  }

  return (
    <HomeScreen
      Action={Action}
      TextInput={TextInput}
      apiBaseUrl={apiBaseUrl}
      userName={auth.user.name}
      onSignOut={handleSignOut}
      canConfigureGateway={canConfigureGateway}
      onConfigureGateway={onConfigureGateway}
      onOpenItem={(item) => useScreenStore.getState().push({ name: 'detail', item })}
    />
  )
}
