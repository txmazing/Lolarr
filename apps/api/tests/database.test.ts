import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext } from './helpers.js'

describe('LolarrDatabase', () => {
  let ctx: ReturnType<typeof createTestContext>
  let db: LolarrDatabase
  const user = { id: 'user-1', name: 'Joel' }

  beforeEach(() => {
    ctx = createTestContext()
    db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    db.upsertUser(user, 'jf-token')
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('round-trips the seerr cookie encrypted', () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Aabc')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Aabc')
  })

  it('returns undefined when no cookie is stored', () => {
    expect(db.getSeerrCookie(user.id)).toBeUndefined()
  })

  it('clears the seerr cookie', () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Aabc')
    db.clearSeerrCookie(user.id)
    expect(db.getSeerrCookie(user.id)).toBeUndefined()
  })

  it('deletes all sessions of a user', () => {
    const { token } = db.createSession(user)
    db.deleteSessionsForUser(user.id)
    expect(db.findSession(token)).toBeUndefined()
  })

  it('keeps upsertUser from wiping the seerr cookie', () => {
    db.saveSeerrCookie(user.id, 'connect.sid=s%3Aabc')
    db.upsertUser(user, 'new-jf-token')
    expect(db.getSeerrCookie(user.id)).toBe('connect.sid=s%3Aabc')
  })
})

describe('requests table migration', () => {
  it('drops the legacy requests table on migration', () => {
    const path = join(tmpdir(), `lolarr-migrate-${randomUUID()}.sqlite`)
    const legacy = new DatabaseSync(path)
    legacy.exec(`create table requests (id text primary key)`)
    legacy.close()

    new LolarrDatabase(path, 'test-secret-at-least-16-chars')

    const check = new DatabaseSync(path)
    const table = check
      .prepare(`select name from sqlite_master where type = 'table' and name = 'requests'`)
      .get()
    check.close()
    rmSync(path, { force: true })
    expect(table).toBeUndefined()
  })
})

describe('notifications', () => {
  function freshDb() {
    const path = join(tmpdir(), `lolarr-notif-${randomUUID()}.sqlite`)
    const db = new LolarrDatabase(path, 'test-secret-at-least-16-chars')
    db.upsertUser({ id: 'u1', name: 'Joel' }, 'jf-token')
    return { db, path }
  }

  it('inserts and lists a notification, deduping on (user, tmdb, mediaType, kind)', () => {
    const { db } = freshDb()
    expect(
      db.insertNotification({ id: 'n1', userId: 'u1', kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' }),
    ).toBe(true)
    // same key again → no-op, returns false
    expect(
      db.insertNotification({ id: 'n2', userId: 'u1', kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club' }),
    ).toBe(false)
    const rows = db.listNotifications('u1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'n1', kind: 'available', tmdbId: 550, mediaType: 'movie', title: 'Fight Club', read: false })
  })

  it('counts unread and marks all read', () => {
    const { db } = freshDb()
    db.insertNotification({ id: 'n1', userId: 'u1', kind: 'available', tmdbId: 1, mediaType: 'movie', title: 'A' })
    db.insertNotification({ id: 'n2', userId: 'u1', kind: 'declined', tmdbId: 2, mediaType: 'movie', title: 'B' })
    expect(db.countUnread('u1')).toBe(2)
    db.markNotificationsRead('u1')
    expect(db.countUnread('u1')).toBe(0)
    expect(db.listNotifications('u1').every((row) => row.read)).toBe(true)
  })

  it('finds a user by name case-insensitively', () => {
    const { db } = freshDb()
    expect(db.findUserByName('joel')?.id).toBe('u1')
    expect(db.findUserByName('JOEL')?.id).toBe('u1')
    expect(db.findUserByName('nobody')).toBeUndefined()
  })
})
