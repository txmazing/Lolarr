export interface KeyValueStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export const localStorageAdapter: KeyValueStorage = {
  get(key) {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  },
  set(key, value) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value)
    }
  },
  remove(key) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
  },
}

const deviceIdKey = 'lolarr.device-id'

export function getOrCreateDeviceId(storage: KeyValueStorage): string {
  const existing = storage.get(deviceIdKey)
  if (existing) {
    return existing
  }
  const deviceId = crypto.randomUUID()
  storage.set(deviceIdKey, deviceId)
  return deviceId
}
