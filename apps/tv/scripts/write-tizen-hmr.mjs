#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_DEV_PORT = 5173
const scriptDir = dirname(fileURLToPath(import.meta.url))
const tvRoot = join(scriptDir, '..')
const tizenDir = join(tvRoot, 'tizen')
const publicDir = join(tvRoot, 'public')

function getLocalIpv4Address() {
  for (const networkInterface of Object.values(networkInterfaces())) {
    for (const address of networkInterface ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address
      }
    }
  }

  return 'localhost'
}

function normalizeDevServerUrl() {
  const configuredUrl = process.env.LOLARR_TV_DEV_SERVER_URL

  if (configuredUrl) {
    return new URL(configuredUrl.endsWith('/') ? configuredUrl : `${configuredUrl}/`)
  }

  const host = process.env.LOLARR_TV_DEV_SERVER_HOST ?? getLocalIpv4Address()
  const port = process.env.LOLARR_TV_DEV_SERVER_PORT ?? String(DEFAULT_DEV_PORT)

  return new URL(`http://${host}:${port}/`)
}

const devServerUrl = normalizeDevServerUrl()
const devServerOrigin = devServerUrl.origin

mkdirSync(tizenDir, { recursive: true })

if (existsSync(publicDir)) {
  cpSync(publicDir, tizenDir, { recursive: true })
}

writeFileSync(
  join(tizenDir, 'index.html'),
  `<!doctype html>
<html lang="en" class="tv-ui">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="${devServerOrigin}/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>lolarr</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import RefreshRuntime from '${devServerOrigin}/@react-refresh'

      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <script type="module" src="${devServerOrigin}/@vite/client"></script>
    <script type="module" src="${devServerOrigin}/src/main.tsx"></script>
  </body>
</html>
`,
)

console.log(`Wrote Tizen HMR entry for ${devServerOrigin}`)
console.log('Deploy apps/tv/tizen once, then keep this Vite dev server running.')
