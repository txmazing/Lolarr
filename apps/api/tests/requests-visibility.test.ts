import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LolarrDatabase } from '../src/services/database.js'
import { createTestContext } from './helpers.js'

describe('request visibility', () => {
  let ctx: ReturnType<typeof createTestContext>

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('only returns requests created by the given user', () => {
    const db = new LolarrDatabase(ctx.config.LOLARR_DATABASE_PATH, ctx.config.LOLARR_SECRET)
    const userA = { id: 'user-a', name: 'A' }
    const userB = { id: 'user-b', name: 'B' }
    db.upsertUser(userA, 'token-a')
    db.upsertUser(userB, 'token-b')
    db.createRequest({ mediaType: 'movie', tmdbId: 1, title: 'One', status: 'pending', requestedBy: userA })
    db.createRequest({ mediaType: 'movie', tmdbId: 2, title: 'Two', status: 'pending', requestedBy: userB })

    const visible = db.listRequests(userA.id)
    expect(visible).toHaveLength(1)
    expect(visible[0]?.title).toBe('One')
  })
})
