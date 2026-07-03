import type { AppConfig } from '../config.js'
import type { LolarrDatabase } from '../services/database.js'
import type { SeerrAdapter } from '../adapters/seerr.js'
import type { SeerrSessionService } from '../services/seerrSession.js'

export type AppContext = {
  config: AppConfig
  database: LolarrDatabase
  seerr: SeerrAdapter
  seerrSession: SeerrSessionService
}
