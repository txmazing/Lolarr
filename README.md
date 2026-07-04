# Lolarr

Moonrepo monorepo for the Lolarr clients.

## Requirements

- **Jellyfin** 10.10+ with **Quick Connect enabled** (Dashboard → General) — the gateway uses the `/UserItems/Resume` endpoint introduced in 10.9, so older servers are not supported
- **Seerr ≥ v3.4.0** (until released: the `develop`/preview image) with:
  - *Enable Jellyfin Sign-In* turned on
  - *Enable New Jellyfin Sign-In* turned on (users log in without prior import)
- Environment: see `.env.example` — all variables are required; the API refuses to start otherwise.

## Tizen TV playback

The TV app plays video through Samsung's native AVPlay API (`packages/player` →
`tizenPlatform`), injected via `LolarrApp`'s `playerPlatform` prop. Web keeps the
default `webPlatform` (HTML5 `<video>` + hls.js). Requirements on the TV:

- `config.xml` privileges: `avplay`, `tv.inputdevice`, `productinfo`, `systeminfo`,
  `tv.audio`, `internet`, `network.public`.
- Build and package: `pnpm --filter @lolarr/tv tizen:sync`, then load the `apps/tv/tizen`
  project in Tizen Studio and deploy to the device (a signed `.wgt` is not produced by CI).
- DTS/DCA audio always transcodes (unsupported on every Tizen year). The device profile
  detects the model year to enable HEVC/VP9/AV1 where available.
- On-device verification is manual — there is no Tizen emulator in CI.

### On-device smoke checklist

Run after each `tizen:sync` deploy — none of this is exercised in CI:

- [ ] **Cold-start play** — pick a movie, playback begins from the device profile without a lingering AVPlay session error.
- [ ] **Resume** — reopen a partially watched title and confirm it seeks to the saved position (HLS resume is deferred ~1.5s after play).
- [ ] **Next episode** — let an episode finish (or skip to the end) and confirm the next one loads without a stuck/black AVPlay surface.
- [ ] **Back cascade** — the Back/Return key (10009) first hides the controls, then exits the player.
- [ ] **Media keys** — Play/Pause/Stop and Rewind/Fast-Forward on the remote drive the player.

## Notifications

Lolarr surfaces request-lifecycle updates (available / approved / declined / failed) as a
one-time toast plus an unread badge on the Requests entry. It relies on Seerr's webhook agent
(**Settings → Notifications → Webhook**).

**API side:** set `LOLARR_WEBHOOK_SECRET` (16+ chars) in the API environment. It is read once at
startup — **restart the API after changing it.**

**Seerr webhook fields:**

| Field | Value |
| --- | --- |
| Webhook URL | `http://<lolarr-api-host>:4000/api/webhooks/seerr` — the host must be reachable **from the Seerr server** (not `localhost` unless Seerr runs on the same machine) |
| Authorization Header | the **exact** `LOLARR_WEBHOOK_SECRET` value — no `Bearer` prefix, no trailing whitespace |
| Custom Headers | leave empty (only needed if your Seerr build has no dedicated Authorization Header field, then use `{"Authorization": "<secret>"}`) |
| Notification Types | tick only **Request Available**, **Request Approved**, **Request Declined**, and **Request Processing Failed**. Leave *Pending* and *Automatically Approved* off — the API treats them as no-ops. |
| JSON Payload | keep Seerr's **default** — it already carries `notification_type`, `subject`, `media.media_type`, `media.tmdbId`, and `request.requestedBy_username` (all the API reads; extra fields are ignored). Its conditional `{{media}}`/`{{request}}` blocks also let the **Test** button (which has no media) return 200. |

Matching is by Jellyfin username (`requestedBy_username` == the Jellyfin user name, case-insensitive,
ASCII); a user only sees notifications for their own requests. A user who has never signed into
Lolarr is silently dropped.

**Troubleshooting the Test button:**

- **401 `Invalid webhook secret`** — the API reached is running a *different* `LOLARR_WEBHOOK_SECRET`
  than the Authorization Header sends. Confirm both match byte-for-byte and that you restarted the
  API after editing its env. Quick local check:
  `curl -si -XPOST http://localhost:4000/api/webhooks/seerr -H "authorization: <secret>" -H "content-type: application/json" -d '{"notification_type":"TEST_NOTIFICATION","subject":"Test"}'` → expect `200 {"ok":true}`.
- **"could not be sent" / connection error** — Seerr cannot reach the URL (DNS, firewall, wrong host).
  A remote Seerr cannot reach a `localhost` API; expose the API or tunnel to it.
- **400 `Malformed webhook payload`** — only for genuinely unparseable JSON (bad syntax). Well-formed
  payloads, including the default-template Test notification (whose `media`/`request` fields arrive
  empty), are accepted as a `200` no-op.

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
