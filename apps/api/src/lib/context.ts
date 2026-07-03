import type { AppConfig } from '../config.js'
import type { LolarrDatabase } from '../services/database.js'
import type { SeerrAdapter } from '../adapters/seerr.js'

export type AppContext = {
  config: AppConfig
  database: LolarrDatabase
  seerr: SeerrAdapter
}
