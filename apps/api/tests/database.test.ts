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
