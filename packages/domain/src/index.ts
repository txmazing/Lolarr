import { z } from 'zod'

export const mediaTypeSchema = z.enum(['movie', 'tv'])
export type MediaType = z.infer<typeof mediaTypeSchema>

export const availabilitySchema = z.enum([
  'available',
  'requestable',
  'requested',
  'processing',
  'unavailable',
])
export type Availability = z.infer<typeof availabilitySchema>

export const mediaItemSchema = z.object({
  id: z.string(),
  mediaType: mediaTypeSchema,
  title: z.string(),
  year: z.number().int().optional(),
  overview: z.string(),
  posterUrl: z.string().optional(),
  backdropUrl: z.string().optional(),
  tmdbId: z.number().int(),
  jellyfinItemId: z.string().optional(),
  seerrMediaId: z.number().int().optional(),
  availability: availabilitySchema,
})
export type MediaItem = z.infer<typeof mediaItemSchema>

export const mediaRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  items: z.array(mediaItemSchema),
})
export type MediaRow = z.infer<typeof mediaRowSchema>

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type LolarrUser = z.infer<typeof userSchema>

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

export const sessionResponseSchema = z.object({
  user: userSchema.nullable(),
})
export type SessionResponse = z.infer<typeof sessionResponseSchema>

export const discoverResponseSchema = z.object({
  rows: z.array(mediaRowSchema),
})
export type DiscoverResponse = z.infer<typeof discoverResponseSchema>

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(mediaItemSchema),
})
export type SearchResponse = z.infer<typeof searchResponseSchema>

export const mediaDetailResponseSchema = z.object({
  item: mediaItemSchema,
})
export type MediaDetailResponse = z.infer<typeof mediaDetailResponseSchema>

export const requestStatusSchema = z.enum([
  'pending',
  'approved',
  'processing',
  'available',
  'failed',
])
export type RequestStatus = z.infer<typeof requestStatusSchema>

export const mediaRequestSchema = z.object({
  id: z.string(),
  mediaType: mediaTypeSchema,
  tmdbId: z.number().int(),
  title: z.string(),
  status: requestStatusSchema,
  requestedBy: userSchema,
  createdAt: z.string(),
})
export type MediaRequest = z.infer<typeof mediaRequestSchema>

export const createRequestSchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.number().int(),
  title: z.string().min(1),
})
export type CreateRequest = z.infer<typeof createRequestSchema>

export const requestsResponseSchema = z.object({
  requests: z.array(mediaRequestSchema),
})
export type RequestsResponse = z.infer<typeof requestsResponseSchema>

export const errorResponseSchema = z.object({
  error: z.string(),
})
export type ErrorResponse = z.infer<typeof errorResponseSchema>

export const demoUser: LolarrUser = {
  id: 'demo',
  name: 'Demo User',
}

export const demoRows: MediaRow[] = [
  {
    id: 'trending',
    title: 'Trending now',
    items: [
      {
        id: 'movie-872585',
        mediaType: 'movie',
        title: 'Oppenheimer',
        year: 2023,
        overview:
          'A dense, uneasy portrait of ambition, secrecy, and the cost of changing history.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
        tmdbId: 872585,
        availability: 'available',
      },
      {
        id: 'tv-1399',
        mediaType: 'tv',
        title: 'Game of Thrones',
        year: 2011,
        overview:
          'Noble families fight for power while an ancient threat gathers beyond the wall.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
        tmdbId: 1399,
        availability: 'requestable',
      },
      {
        id: 'movie-155',
        mediaType: 'movie',
        title: 'The Dark Knight',
        year: 2008,
        overview:
          'A masked vigilante faces a criminal force built to expose the limits of order.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg',
        tmdbId: 155,
        availability: 'available',
      },
    ],
  },
  {
    id: 'popular',
    title: 'Popular requests',
    items: [
      {
        id: 'movie-693134',
        mediaType: 'movie',
        title: 'Dune: Part Two',
        year: 2024,
        overview:
          'Paul Atreides joins the Fremen and follows a path that may consume the empire.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
        tmdbId: 693134,
        availability: 'requested',
      },
      {
        id: 'tv-94997',
        mediaType: 'tv',
        title: 'House of the Dragon',
        year: 2022,
        overview:
          'A dynastic conflict turns dragons and succession into a family war.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg',
        tmdbId: 94997,
        availability: 'requestable',
      },
    ],
  },
  {
    id: 'available',
    title: 'Ready in Jellyfin',
    items: [
      {
        id: 'movie-603',
        mediaType: 'movie',
        title: 'The Matrix',
        year: 1999,
        overview:
          'A programmer discovers that ordinary reality is a carefully controlled simulation.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
        tmdbId: 603,
        availability: 'available',
      },
      {
        id: 'tv-66732',
        mediaType: 'tv',
        title: 'Stranger Things',
        year: 2016,
        overview:
          'A small town mystery opens into a government experiment and another dimension.',
        posterUrl:
          'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
        backdropUrl:
          'https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
        tmdbId: 66732,
        availability: 'available',
      },
    ],
  },
]

export function findDemoItem(mediaType: MediaType, tmdbId: number) {
  return demoRows
    .flatMap((row) => row.items)
    .find((item) => item.mediaType === mediaType && item.tmdbId === tmdbId)
}

export function searchDemoItems(query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return []
  }

  return demoRows
    .flatMap((row) => row.items)
    .filter((item) => item.title.toLowerCase().includes(normalizedQuery))
}
