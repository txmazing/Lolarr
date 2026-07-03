import { z } from 'zod'

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  JELLYFIN_URL: z.string().url().optional(),
  SEERR_URL: z.string().url().optional(),
  SEERR_API_KEY: z.string().optional(),
  LOLARR_SECRET: z.string().min(16).default('development-lolarr-secret'),
  LOLARR_DATABASE_PATH: z.string().default('./data/lolarr.sqlite'),
})

export type AppConfig = z.infer<typeof envSchema>

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env)
}

export function hasExternalServices(config: AppConfig) {
  return Boolean(config.JELLYFIN_URL && config.SEERR_URL && config.SEERR_API_KEY)
}
