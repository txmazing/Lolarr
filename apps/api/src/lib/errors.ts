export class UpstreamError extends Error {
  readonly service: 'jellyfin' | 'seerr'
  readonly status: number | undefined

  constructor(service: 'jellyfin' | 'seerr', status: number | undefined, message: string) {
    super(message)
    this.name = 'UpstreamError'
    this.service = service
    this.status = status
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid Jellyfin credentials')
    this.name = 'InvalidCredentialsError'
  }
}

export class JellyfinTokenInvalidError extends Error {
  readonly userId: string

  constructor(userId: string) {
    super('Stored Jellyfin token is no longer valid')
    this.name = 'JellyfinTokenInvalidError'
    this.userId = userId
  }
}
