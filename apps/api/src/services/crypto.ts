import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const algorithm = 'aes-256-gcm'

export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function encryptText(value: string, secret: string) {
  const key = createKey(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, encrypted]
    .map((part) => part.toString('base64url'))
    .join('.')
}

export function decryptText(value: string, secret: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.')

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted value')
  }

  const key = createKey(secret)
  const decipher = createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function createKey(secret: string) {
  return createHash('sha256').update(secret).digest()
}
