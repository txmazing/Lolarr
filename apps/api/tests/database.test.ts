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
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('upgrades a pre-existing global-unique requests table to per-user unique, preserving rows', () => {
    // Simulate a Slice-1 database created before the per-user unique constraint existed.
    const legacy = new DatabaseSync(ctx.config.LOLARR_DATABASE_PATH)
    legacy.exec(`
      create table users (
        id text primary key,
        name text not null,
        jellyfin_token text not null
      );
      create table sessions (
        token_hash text primary key,
        user_id text not null references users(id),
        expires_at text not null,
        created_at text not null default current_timestamp
      );
      create table requests (
        id text primary key,
        user_id text not null references users(id),
        media_type text not null,
        tmdb_id integer not null,
        title text not null,
        status text not null,
        seerr_request_id text,
        created_at text not null,
        unique(media_type, tmdb_id)
      );
      insert into users (id, name, jellyfin_token) values ('user-a', 'A', 'enc-a');
      insert into requests (id, user_id, media_type, tmdb_id, title, status, created_at)
        values ('legacy-request-1', 'user-a', 'movie', 99, 'Legacy Movie', 'pending', '2024-01-01T00:00:00.000Z');
    `)
    legacy.close()

    // Opening via LolarrDatabase triggers migrate(), which should detect the old
    // constraint, rebuild the table, and preserve existing rows.
    const migrated = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    const userA = { id: 'user-a', name: 'A' }
    const userB = { id: 'user-b', name: 'B' }
    migrated.upsertUser(userB, 'token-b')

    const existing = migrated.listRequests(userA.id)
    expect(existing).toHaveLength(1)
    expect(existing[0]?.title).toBe('Legacy Movie')

    // The new constraint must be per-user: user B can now request the same tmdbId.
    expect(() =>
      migrated.createRequest({
        mediaType: 'movie',
        tmdbId: 99,
        title: 'Legacy Movie',
        status: 'pending',
        requestedBy: userB,
      }),
    ).not.toThrow()
    expect(migrated.listRequests(userB.id)).toHaveLength(1)

    // Re-running migrate() (e.g. process restart) must be a no-op — idempotent.
    expect(() => new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)).not.toThrow()
  })
})
