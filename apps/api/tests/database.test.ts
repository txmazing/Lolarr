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
