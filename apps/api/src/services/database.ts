import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { LolarrUser, MediaRequest, MediaType, RequestStatus } from '@lolarr/domain'
import { decryptText, encryptText, hashValue } from './crypto.js'

export type StoredSession = {
  token: string
  user: LolarrUser
}

export type RequestInput = {
  mediaType: MediaType
  tmdbId: number
  title: string
  status: RequestStatus
  seerrRequestId?: string
  requestedBy: LolarrUser
}

export class LolarrDatabase {
  private readonly database: DatabaseSync
  private readonly secret: string

  constructor(path: string, secret: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.database = new DatabaseSync(path)
    this.secret = secret
    this.migrate()
  }

  upsertUser(user: LolarrUser, jellyfinToken: string) {
    const encryptedToken = encryptText(jellyfinToken, this.secret)
    this.database
      .prepare(
        `insert into users (id, name, jellyfin_token)
         values (?, ?, ?)
         on conflict(id) do update set
           name = excluded.name,
           jellyfin_token = excluded.jellyfin_token`,
      )
      .run(user.id, user.name, encryptedToken)
  }

  createSession(user: LolarrUser) {
    const token = randomSessionToken()
    const tokenHash = hashValue(token)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()

    this.database
      .prepare(
        `insert into sessions (token_hash, user_id, expires_at)
         values (?, ?, ?)`,
      )
      .run(tokenHash, user.id, expiresAt)

    return { token, user }
  }

  findSession(token: string): StoredSession | undefined {
    const row = this.database
      .prepare(
        `select users.id, users.name
         from sessions
         inner join users on users.id = sessions.user_id
         where sessions.token_hash = ? and sessions.expires_at > ?`,
      )
      .get(hashValue(token), new Date().toISOString()) as
      | { id: string; name: string }
      | undefined

    if (!row) {
      return undefined
    }

    return {
      token,
      user: {
        id: row.id,
        name: row.name,
      },
    }
  }

  getJellyfinToken(userId: string) {
    const row = this.database
      .prepare('select jellyfin_token from users where id = ?')
      .get(userId) as { jellyfin_token: string } | undefined

    if (!row) {
      return undefined
    }

    return decryptText(row.jellyfin_token, this.secret)
  }

  listRequests(userId: string): MediaRequest[] {
    const rows = this.database
      .prepare(
        `select requests.id, requests.media_type, requests.tmdb_id, requests.title,
                requests.status, requests.created_at, users.id as user_id,
                users.name as user_name
         from requests
         inner join users on users.id = requests.user_id
         where requests.user_id = ?
         order by requests.created_at desc`,
      )
      .all(userId) as StoredRequestRow[]

    return rows.map(mapRequestRow)
  }

  createRequest(input: RequestInput) {
    // Includes the requesting user because the unique constraint is now
    // per-user: two different users can request the same (mediaType, tmdbId)
    // in the same millisecond, and each needs its own row id.
    const id = `request-${input.requestedBy.id}-${input.mediaType}-${input.tmdbId}-${Date.now()}`
    const createdAt = new Date().toISOString()

    this.database
      .prepare(
        `insert into requests (
           id, user_id, media_type, tmdb_id, title, status, seerr_request_id, created_at
         ) values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(user_id, media_type, tmdb_id) do update set
           status = excluded.status,
           seerr_request_id = excluded.seerr_request_id`,
      )
      .run(
        id,
        input.requestedBy.id,
        input.mediaType,
        input.tmdbId,
        input.title,
        input.status,
        input.seerrRequestId ?? null,
        createdAt,
      )

    return this.listRequests(input.requestedBy.id)
  }

  saveSeerrCookie(userId: string, cookie: string) {
    this.database
      .prepare('update users set seerr_cookie = ? where id = ?')
      .run(encryptText(cookie, this.secret), userId)
  }

  getSeerrCookie(userId: string): string | undefined {
    const row = this.database
      .prepare('select seerr_cookie from users where id = ?')
      .get(userId) as { seerr_cookie: string | null } | undefined

    if (!row?.seerr_cookie) {
      return undefined
    }

    return decryptText(row.seerr_cookie, this.secret)
  }

  clearSeerrCookie(userId: string) {
    this.database.prepare('update users set seerr_cookie = null where id = ?').run(userId)
  }

  deleteSessionsForUser(userId: string) {
    this.database.prepare('delete from sessions where user_id = ?').run(userId)
  }

  private migrate() {
    this.database.exec(`
      create table if not exists users (
        id text primary key,
        name text not null,
        jellyfin_token text not null
      );

      create table if not exists sessions (
        token_hash text primary key,
        user_id text not null references users(id),
        expires_at text not null,
        created_at text not null default current_timestamp
      );

      create table if not exists requests (
        id text primary key,
        user_id text not null references users(id),
        media_type text not null,
        tmdb_id integer not null,
        title text not null,
        status text not null,
        seerr_request_id text,
        created_at text not null,
        unique(user_id, media_type, tmdb_id)
      );
    `)

    const userColumns = this.database
      .prepare(`select name from pragma_table_info('users')`)
      .all() as Array<{ name: string }>

    if (!userColumns.some((column) => column.name === 'seerr_cookie')) {
      this.database.exec(`alter table users add column seerr_cookie text`)
    }

    this.migrateRequestsUniqueConstraintToPerUser()
  }

  /**
   * Early Slice 1 databases created `requests` with `unique(media_type, tmdb_id)`,
   * which is global across all users. With per-user request visibility, a second
   * user requesting media a different user already requested hits a UNIQUE
   * violation instead of getting their own row. Rebuild the table with
   * `unique(user_id, media_type, tmdb_id)` when the old constraint is detected.
   * SQLite can't alter a table's unique constraint in place, so this recreates
   * the table, copies the data across, and swaps it in. Guarded by inspecting
   * `sqlite_master` so re-running migrate() on an already-migrated database is a
   * no-op (same idempotency pattern as the seerr_cookie column check above).
   */
  private migrateRequestsUniqueConstraintToPerUser() {
    const tableDefinition = this.database
      .prepare(`select sql from sqlite_master where type = 'table' and name = 'requests'`)
      .get() as { sql: string } | undefined

    const hasGlobalUniqueConstraint = tableDefinition?.sql
      .replace(/\s+/g, ' ')
      .includes('unique(media_type, tmdb_id)')

    if (!hasGlobalUniqueConstraint) {
      return
    }

    this.database.exec('begin transaction')
    try {
      this.database.exec(`
        create table requests_new (
          id text primary key,
          user_id text not null references users(id),
          media_type text not null,
          tmdb_id integer not null,
          title text not null,
          status text not null,
          seerr_request_id text,
          created_at text not null,
          unique(user_id, media_type, tmdb_id)
        );

        insert into requests_new (
          id, user_id, media_type, tmdb_id, title, status, seerr_request_id, created_at
        )
        select id, user_id, media_type, tmdb_id, title, status, seerr_request_id, created_at
        from requests;

        drop table requests;
        alter table requests_new rename to requests;
      `)
      this.database.exec('commit')
    } catch (error) {
      this.database.exec('rollback')
      throw error
    }
  }
}

type StoredRequestRow = {
  id: string
  media_type: MediaType
  tmdb_id: number
  title: string
  status: RequestStatus
  created_at: string
  user_id: string
  user_name: string
}

function mapRequestRow(row: StoredRequestRow): MediaRequest {
  return {
    id: row.id,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    requestedBy: {
      id: row.user_id,
      name: row.user_name,
    },
  }
}

function randomSessionToken() {
  return `lolarr_${randomUUID()}`
}
