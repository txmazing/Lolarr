import type { KeyValueStorage } from '../storage.js'

const apiBaseUrlStorageKey = 'lolarr.api-base-url'

export function readInitialApiBaseUrl(storage: KeyValueStorage, compiledApiBaseUrl: string) {
  return readStoredApiBaseUrl(storage) ?? compiledApiBaseUrl
}

export function readStoredApiBaseUrl(storage: KeyValueStorage) {
  return storage.get(apiBaseUrlStorageKey) ?? undefined
}

export function writeStoredApiBaseUrl(storage: KeyValueStorage, apiBaseUrl: string) {
  storage.set(apiBaseUrlStorageKey, apiBaseUrl)
}

export function canUseRuntimeGatewayConfig() {
  return typeof window !== 'undefined'
}

export function shouldRequireGatewaySetup(apiBaseUrl: string | undefined) {
  return !apiBaseUrl && isFileProtocol()
}

export function isFileProtocol() {
  return typeof window !== 'undefined' && window.location.protocol === 'file:'
}

export function normalizeApiBaseUrl(value: string) {
  const trimmedValue = value.trim().replace(/\/+$/, '')

  if (!trimmedValue) {
    return undefined
  }

  try {
    const url = new URL(trimmedValue)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    return url.toString().replace(/\/+$/, '')
  } catch {
    return undefined
  }
}
