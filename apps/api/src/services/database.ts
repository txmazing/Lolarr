import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { LolarrUser } from '@lolarr/domain'
import { decryptText, encryptText, hashValue } from './crypto.js'

export type StoredSession = {
  token: string
  user: LolarrUser
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
    `)

    const userColumns = this.database
      .prepare(`select name from pragma_table_info('users')`)
      .all() as Array<{ name: string }>

    if (!userColumns.some((column) => column.name === 'seerr_cookie')) {
      this.database.exec(`alter table users add column seerr_cookie text`)
    }

    // Slice 4: requests live in Seerr (source of truth); the local table from
    // slice 1 is dropped. 'if exists' keeps this idempotent for fresh databases.
    this.database.exec('drop table if exists requests')
  }
}

function randomSessionToken() {
  return `lolarr_${randomUUID()}`
}
