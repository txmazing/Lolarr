import { networkInterfaces } from 'node:os'
import { defineLolarrReactConfig } from '../../config/vite/react.js'

const DEFAULT_TV_DEV_PORT = 5173

function getLocalIpv4Address() {
  for (const networkInterface of Object.values(networkInterfaces())) {
    for (const address of networkInterface ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address
      }
    }
  }

  return undefined
}

function getTvDevServerUrl() {
  const configuredUrl = process.env.LOLARR_TV_DEV_SERVER_URL

  if (configuredUrl) {
    return new URL(configuredUrl)
  }

  const host = process.env.LOLARR_TV_DEV_SERVER_HOST ?? getLocalIpv4Address()

  if (!host) {
    return undefined
  }

  const port = process.env.LOLARR_TV_DEV_SERVER_PORT ?? String(DEFAULT_TV_DEV_PORT)

  return new URL(`http://${host}:${port}`)
}

const tvDevServerUrl = getTvDevServerUrl()

export default defineLolarrReactConfig({
  server: {
    host: '0.0.0.0',
    port: Number(process.env.LOLARR_TV_DEV_SERVER_PORT ?? DEFAULT_TV_DEV_PORT),
    cors: true,
    hmr: tvDevServerUrl
      ? {
          protocol: tvDevServerUrl.protocol === 'https:' ? 'wss' : 'ws',
          host: tvDevServerUrl.hostname,
          clientPort: Number(tvDevServerUrl.port || DEFAULT_TV_DEV_PORT),
        }
      : undefined,
  },
})
