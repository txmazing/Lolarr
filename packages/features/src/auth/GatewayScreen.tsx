import type { FormEvent } from 'react'
import { AppFrame, GatewayPanel, type ActionComponent, type TextInputComponent } from '@lolarr/ui'

export function GatewayScreen({
  Action,
  TextInput,
  apiBaseUrl,
  error,
  onSubmit,
  canConfigureGateway,
  onConfigureGateway,
}: {
  Action: ActionComponent
  TextInput: TextInputComponent
  apiBaseUrl: string
  error: string | undefined
  onSubmit: (nextApiBaseUrl: string) => void
  canConfigureGateway: boolean
  onConfigureGateway: () => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    onSubmit(String(formData.get('apiUrl') ?? ''))
  }

  return (
    <AppFrame
      Action={Action}
      onConfigureGateway={canConfigureGateway ? onConfigureGateway : undefined}
    >
      <form onSubmit={handleSubmit}>
        <GatewayPanel Action={Action} defaultUrl={apiBaseUrl} error={error} TextInput={TextInput} />
      </form>
    </AppFrame>
  )
}
