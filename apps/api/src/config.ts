import { z } from 'zod'

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  JELLYFIN_URL: z.string().url(),
  SEERR_URL: z.string().url(),
  SEERR_API_KEY: z.string().min(1),
  LOLARR_SECRET: z.string().min(16),
  LOLARR_WEBHOOK_SECRET: z.string().min(16),
  LOLARR_DATABASE_PATH: z.string().default('./data/lolarr.sqlite'),
  // Comma-separated allowlist of CORS origins. Unset = reflect any origin,
  // the right default for self-hosted LAN deployments.
  LOLARR_CORS_ORIGIN: z.string().optional(),
})

export type AppConfig = z.infer<typeof envSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ')
    throw new Error(
      `Lolarr API misconfigured — check these environment variables: ${missing}`,
    )
  }

  return result.data
}
