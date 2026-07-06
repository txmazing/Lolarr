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

/**
 * `crypto.randomUUID` is only defined in secure contexts (HTTPS/localhost).
 * LAN deployments served over plain HTTP (e.g. http://192.168.x.x) are an
 * insecure context, so `randomUUID` is missing there even though
 * `crypto.getRandomValues` still works. Fall back to a manual UUIDv4 built
 * from `getRandomValues` in that case.
 */
export function generateUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getOrCreateDeviceId(storage: KeyValueStorage): string {
  const existing = storage.get(deviceIdKey)
  if (existing) {
    return existing
  }
  const deviceId = generateUuid()
  storage.set(deviceIdKey, deviceId)
  return deviceId
}
