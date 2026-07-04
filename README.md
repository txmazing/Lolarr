# Lolarr

Moonrepo monorepo for the Lolarr clients.

## Requirements

- **Jellyfin** 10.10+ with **Quick Connect enabled** (Dashboard → General) — the gateway uses the `/UserItems/Resume` endpoint introduced in 10.9, so older servers are not supported
- **Seerr ≥ v3.4.0** (until released: the `develop`/preview image) with:
  - *Enable Jellyfin Sign-In* turned on
  - *Enable New Jellyfin Sign-In* turned on (users log in without prior import)
- Environment: see `.env.example` — all variables are required; the API refuses to start otherwise.

## Apps

- `apps/api` - Fastify gateway for Jellyfin login, Seerr discovery, requests, and SQLite persistence.
- `apps/web` - React + Vite web app.
- `apps/tv` - React + Vite TV app with Norigin spatial navigation and Tizen packaging output.
- `apps/mobile` - Placeholder for a future Capacitor shell that reuses the web build.
- `apps/desktop` - Placeholder for a future Tauri shell that reuses the web build.

## Packages

- `packages/domain` - Shared Zod schemas, API contracts, and normalized media models.
- `packages/api-client` - Typed Fetch client used by all React clients.
- `packages/features` - Shared TanStack Query screens and product flows.
- `packages/ui` - Shared React UI components and styles used by all clients.

## Commands

```sh
pnpm install
pnpm run dev:api
pnpm run dev:web
pnpm run dev:tv
pnpm run dev
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run tizen:sync
```

Targeted Moon commands:

```sh
npx moon run web:build
npx moon run tv:build
npx moon run tv:tizen-sync
```

## Configuration

Copy `.env.example` to `.env` for Docker or export these values locally:

- `JELLYFIN_URL` - Jellyfin server URL.
- `SEERR_URL` - Seerr server URL.
- `SEERR_API_KEY` - Seerr admin API key. Used only for user-independent reads (discover, search, media details); requests are created/deleted via per-user Seerr sessions.
- `LOLARR_SECRET` - Secret used to encrypt stored Jellyfin tokens.
- `LOLARR_DATABASE_PATH` - SQLite database path.
- `LOLARR_CORS_ORIGIN` - Optional comma-separated list of allowed CORS origins. Unset allows any origin (self-hosting default).

If Jellyfin or Seerr are not configured, `apps/api` serves demo data so the UI can be developed locally.

## Docker

```sh
docker compose up --build
```

The web app is served on `http://localhost:8080` and proxies `/api` to the gateway. The API also listens on `http://localhost:4000`.

## Tizen

`pnpm run tizen:sync` builds the TV app with the Tizen-specific Vite config and syncs the generated files into `apps/tv/tizen`.

Open `apps/tv/tizen` in Tizen Studio, refresh the project, clean/build a signed package, then install the new `.wgt` on the TV.

The installed TV app runs from `file://`, so relative API paths like `/api` do not work there. On first launch, enter the gateway URL shown by the API server, for example `http://192.168.1.50:4000`. The value is stored in TV local storage and can be changed with the `Gateway` button in the app header.

You can also bake the gateway URL into a build:

```sh
VITE_LOLARR_API_URL=http://192.168.1.50:4000 pnpm run tizen:sync
```
