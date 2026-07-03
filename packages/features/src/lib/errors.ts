import { LolarrApiError } from '@lolarr/api-client'

export function readErrorMessage(error: unknown) {
  if (error instanceof LolarrApiError || error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
