# Lolarr

Moonrepo monorepo for the Lolarr clients.

## Apps

- `apps/web` - React + Vite web app.
- `apps/tv` - React + Vite TV app with Norigin spatial navigation and Tizen packaging output.
- `apps/mobile` - Placeholder for a future Capacitor shell that reuses the web build.
- `apps/desktop` - Placeholder for a future Tauri shell that reuses the web build.
- `packages/ui` - Shared React UI, assets, and styles used by all clients.

## Commands

```sh
pnpm install
pnpm run dev:web
pnpm run dev:tv
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

## Tizen

`pnpm run tizen:sync` builds the TV app with the Tizen-specific Vite config and syncs the generated files into `apps/tv/tizen`.

Open `apps/tv/tizen` in Tizen Studio, refresh the project, clean/build a signed package, then install the new `.wgt` on the TV.
