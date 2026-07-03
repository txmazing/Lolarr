import { z } from 'zod'

export const mediaTypeSchema = z.enum(['movie', 'tv'])
export type MediaType = z.infer<typeof mediaTypeSchema>

export const availabilitySchema = z.enum([
  'available',
  'partiallyAvailable',
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

