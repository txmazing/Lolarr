import { loadConfig } from './config.js'
import { createServer } from './server.js'

const config = loadConfig()
const server = createServer(config)

await server.listen({
  host: config.HOST,
  port: config.PORT,
})
