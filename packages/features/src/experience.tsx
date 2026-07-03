import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { LoginRequest, LoginResponse } from '@lolarr/domain'
import type { ActionComponent, TextInputComponent } from '@lolarr/ui'
import { DetailScreen } from './detail/DetailScreen.js'
import { HomeScreen } from './home/HomeScreen.js'
import { LibraryDetailScreen } from './library/LibraryDetailScreen.js'
import { LoginScreen } from './auth/LoginScreen.js'
import { QuickConnectScreen } from './auth/QuickConnectScreen.js'
import { PlayerScreen } from './player/PlayerScreen.js'
import { adoptSession, useAuth } from './auth/useAuth.js'
import { useCurrentScreen, useScreenStore } from './navigation/store.js'
import { getOrCreateDeviceId, type KeyValueStorage } from './storage.js'

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
  const queryClient = useQueryClient()
  const [loginMode, setLoginMode] = useState<'password' | 'quickconnect'>('password')

  function handleSignOut() {
    auth.signOut()
    useScreenStore.getState().reset()
  }

  function handleLogin(payload: Omit<LoginRequest, 'deviceId'>) {
    auth.login(payload)
  }

  function handleQuickConnectAuthenticated(response: LoginResponse) {
    adoptSession(response, { storage, apiBaseUrl, setToken, queryClient })
    setLoginMode('password')
  }

  if (!auth.user) {
    if (loginMode === 'quickconnect') {
      return (
        <QuickConnectScreen
          Action={Action}
          deviceId={getOrCreateDeviceId(storage)}
          onAuthenticated={handleQuickConnectAuthenticated}
          onCancel={() => setLoginMode('password')}
        />
      )
    }

    return (
      <LoginScreen
        Action={Action}
        TextInput={TextInput}
        isSessionLoading={auth.isSessionLoading}
        loginError={auth.loginError}
        isLoggingIn={auth.isLoggingIn}
        onLogin={handleLogin}
        onQuickConnect={() => setLoginMode('quickconnect')}
        canConfigureGateway={canConfigureGateway}
        onConfigureGateway={onConfigureGateway}
      />
    )
  }

  if (currentScreen.name === 'player') {
    return (
      <PlayerScreen
        key={currentScreen.itemId}
        Action={Action}
        storage={storage}
        itemId={currentScreen.itemId}
        resumeTicks={currentScreen.resumeTicks}
        onExit={() => {
          void queryClient.invalidateQueries({ queryKey: ['home'] })
          useScreenStore.getState().pop()
        }}
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

  if (currentScreen.name === 'libraryDetail') {
    return (
      <LibraryDetailScreen
        key={currentScreen.itemId}
        Action={Action}
        apiBaseUrl={apiBaseUrl}
        storage={storage}
        itemId={currentScreen.itemId}
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
      storage={storage}
      apiBaseUrl={apiBaseUrl}
      userName={auth.user.name}
      onSignOut={handleSignOut}
      canConfigureGateway={canConfigureGateway}
      onConfigureGateway={onConfigureGateway}
      onOpenItem={(item) =>
        useScreenStore.getState().push(
          item.jellyfin
            ? { name: 'libraryDetail', itemId: item.jellyfin.itemId }
            : { name: 'detail', item },
        )
      }
    />
  )
}
