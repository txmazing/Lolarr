# Lolarr Slice 7: UI-Foundation & Screen-Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tailwind v4 + shadcn/ui in `packages/ui` einführen und alle 9 Screens auf den abyss-monochromen Glass-Look bringen (Web + Samsung-TV gleichrangig).

**Architecture:** Tailwind v4 hängt in der geteilten Vite-Factory (`config/vite/react.ts`), die Design-Tokens leben in `packages/ui/src/theme.css` (`@theme`-Block). shadcn-Dateien bleiben pristine unter `packages/ui/src/components/ui/shadcn/`; alle Lolarr-Anpassungen leben in Wrappern unter `packages/ui/src/components/ui/`. Das DI-Muster (`ActionComponent`/`TextInputComponent`/`ShellProps`) bleibt die Plattform-Naht; Norigin behält auf TV die Fokus-Hoheit.

**Tech Stack:** React 19, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (Radix), CVA + `tailwind-merge`, `@fontsource-variable/inter`, Vitest 3 + Testing Library, moon.

## Global Constraints

- Browser-Floor: **Tizen 9.0 / Chromium M120**; Workarounds für ältere Engines sind NICHT Teil dieses Slices.
- Dark-only, kein Light-Theme.
- shadcn-Dateien unter `packages/ui/src/components/ui/shadcn/` werden **nie editiert** (Update via `pnpm dlx shadcn@latest add <name> --yes --overwrite`). Anpassungen nur in Wrappern unter `packages/ui/src/components/ui/`. Screens/Features importieren ausschließlich Wrapper bzw. die bestehenden `@lolarr/ui`-Exporte.
- Kein sonner; `ToastStack` bleibt.
- API-/Verhaltens-Änderungen sind erlaubt, wenn UI/UX es verlangt — jede Änderung im Task-Report dokumentieren und Konsumenten + Tests **im selben Task** anpassen.
- Design-System: Radii nur `--radius-sm 8px` / `--radius-md 12px` / `--radius-lg 24px` / Pill (`rounded-full`); Easing nur `--ease-out-expo cubic-bezier(0.16,1,0.3,1)` und `--ease-snappy cubic-bezier(0.4,0,0.2,1)`; Blur nur `--blur-overlay 15px` (Overlays) und `--blur-controls 4px` (Controls). Keine Ad-hoc-Werte.
- Primär-Button: gefülltes Fast-Weiß (`--primary #f5f5f7`) mit Text `#0a0a0c`.
- Wellen ②-④ (Tasks 7-10) dürfen erst nach bestandenem Phase-0-Gate (Task 5) starten. Nach jeder Welle: User-Abnahme auf dem S94C, bevor die nächste Welle beginnt.
- Verifikation pro Task (sofern nicht anders angegeben):
  `moon run ui:test features:test ui:typecheck web:build tv:tizen-sync`
- Commits: Conventional Commits (`feat(ui): …`, `chore(ui): …`), pro Task mindestens ein Commit. NICHT pushen.

## Datei-Landkarte

| Datei | Verantwortung |
|---|---|
| `config/vite/react.ts` | geteilte Vite-Factory: bekommt `@tailwindcss/vite`-Plugin + `@ui`-Alias |
| `packages/ui/src/theme.css` | NEU: Tailwind-Entry, alle Tokens, Base-Styles, Custom-Utilities (`glass`, `glass-controls`), `focused`-Variante |
| `packages/ui/src/lib/utils.ts` | NEU: `cn()` (clsx + tailwind-merge) |
| `packages/ui/components.json` | NEU: shadcn-Konfiguration (Aliase → `@ui/*`) |
| `packages/ui/src/components/ui/shadcn/*` | GENERIERT: button, input, dialog, tabs, badge, skeleton — pristine |
| `packages/ui/src/components/ui/*.tsx` | NEU: Wrapper (Button, Input, GlassDialog, PillTabs) |
| `packages/ui/src/components/*.tsx` | Bestand: wird wellenweise auf Wrapper/Utilities umgestellt |
| `packages/ui/src/styles.css` | Legacy-CSS: wird wellenweise geleert, in Task 10 gelöscht |
| `packages/features/src/**/*Screen.tsx` | Screens: Klassen-Umstellung je Welle |
| `apps/tv/src/App.tsx` | `TvAction`/`TvTextInput`/`TvShell`: Anschluss an Wrapper-Styles |
| `apps/tv/src/SpikeScreen.tsx` | NEU (Task 5, hinter Env-Flag): Phase-0-Gate |

---

### Task 1: Tailwind-v4-Fundament + Design-Tokens

**Files:**
- Modify: `package.json` (Root, devDependencies)
- Modify: `config/vite/react.ts`
- Create: `packages/ui/src/theme.css`
- Modify: `packages/ui/package.json` (exports + dependencies)
- Modify: `apps/web/src/main.tsx`, `apps/tv/src/main.tsx`
- Modify: `apps/web/index.html`, `apps/tv/index.html`, `apps/tv/tizen-index.html`
- Modify: `apps/tv/vite.tizen.config.ts`

**Interfaces:**
- Produces: Package-Export `@lolarr/ui/theme.css`; Tailwind-Utilities inkl. `glass`, `glass-controls`, Variante `focused:`; Token-Namespace (`bg-background`, `text-foreground`, `bg-surface`/`-2`/`-3`, `text-muted-foreground`, `border-border`, `text-status-*`, `text-danger`, `rounded-sm/md/lg`, `ease-out-expo`, `ease-snappy`, `font-sans` = Inter).

- [ ] **Step 1: Dependencies installieren**

```bash
pnpm add -Dw tailwindcss @tailwindcss/vite
pnpm --filter @lolarr/ui add @fontsource-variable/inter tw-animate-css
```

- [ ] **Step 2: Vite-Factory erweitern**

`config/vite/react.ts` — Tailwind-Plugin + `@ui`-Alias (für Task 2) einhängen:

```ts
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type UserConfig } from 'vite'

const uiSrc = fileURLToPath(new URL('../../packages/ui/src', import.meta.url))

export function defineLolarrReactConfig(config: UserConfig = {}) {
  const { plugins = [], server, resolve, ...rest } = config

  return defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
      base: './',
      ...rest,
      define: {
        __LOLARR_API_URL__: JSON.stringify(
          process.env.VITE_LOLARR_API_URL ?? env.VITE_LOLARR_API_URL ?? '',
        ),
        ...rest.define,
      },
      resolve: {
        alias: { '@ui': uiSrc },
        ...resolve,
      },
      server: {
        proxy: {
          '/api': 'http://localhost:4000',
          '/health': 'http://localhost:4000',
        },
        ...server,
      },
      plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
        ...plugins,
      ],
    }
  })
}
```

- [ ] **Step 3: `packages/ui/src/theme.css` anlegen** (vollständig)

```css
/* Lolarr Design-Tokens + Tailwind-v4-Entry (Slice 7, abyss-monochrom, dark-only) */
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@fontsource-variable/inter';

/* Utility-Quellen: geteilte Pakete + beide Apps (Pfade relativ zu dieser Datei) */
@source './';
@source '../../features/src/';
@source '../../../apps/web/src/';
@source '../../../apps/tv/src/';

/* TvAction/TvTextInput togglen die Klasse `focused` — als Variante nutzbar */
@custom-variant focused (&.focused);

:root {
  /* shadcn-kompatible Basis-Tokens, Werte = abyss-monochrom */
  --background: #0a0a0c;
  --foreground: #f5f5f7;
  --card: rgb(255 255 255 / 0.04);
  --card-foreground: #f5f5f7;
  --popover: rgb(42 42 42 / 0.9);
  --popover-foreground: #f5f5f7;
  --primary: #f5f5f7;
  --primary-foreground: #0a0a0c;
  --secondary: rgb(255 255 255 / 0.07);
  --secondary-foreground: #f5f5f7;
  --muted: rgb(255 255 255 / 0.07);
  --muted-foreground: #a1a1a6;
  --accent: rgb(255 255 255 / 0.11);
  --accent-foreground: #f5f5f7;
  --destructive: #d97b7b;
  --destructive-foreground: #0a0a0c;
  --border: rgb(255 255 255 / 0.1);
  --input: rgb(255 255 255 / 0.1);
  --ring: #f5f5f7;
  --radius: 12px;

  /* Lolarr-spezifische Tokens */
  --surface: rgb(255 255 255 / 0.04);
  --surface-2: rgb(255 255 255 / 0.07);
  --surface-3: rgb(255 255 255 / 0.11);
  --glass: rgb(42 42 42 / 0.6);
  --blur-overlay: 15px;
  --blur-controls: 4px;
  --status-available: #6fbf9f;
  --status-processing: #8fa8c9;
  --status-pending: #c9b37e;
  --status-declined: #c98181;
  --status-failed: #c98181;
  --status-requested: #a393c9;
  --danger: #d97b7b;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-status-available: var(--status-available);
  --color-status-processing: var(--status-processing);
  --color-status-pending: var(--status-pending);
  --color-status-declined: var(--status-declined);
  --color-status-failed: var(--status-failed);
  --color-status-requested: var(--status-requested);
  --color-danger: var(--danger);

  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 24px;

  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-snappy: cubic-bezier(0.4, 0, 0.2, 1);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  html {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* 10-Foot-UI: beide TV-HTMLs tragen class="tv-ui" auf <html> */
  html.tv-ui {
    font-size: 150%;
  }

  body {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    background: var(--color-background);
    color: var(--color-foreground);
  }

  button,
  input {
    font: inherit;
  }
}

/* Frosted Glass — Overlays (Dialoge, Modals) */
@utility glass {
  background: var(--glass);
  -webkit-backdrop-filter: blur(var(--blur-overlay));
  backdrop-filter: blur(var(--blur-overlay));
}

/* Frosted Glass — schwebende Controls (Player-Leiste, Buttons auf Bild) */
@utility glass-controls {
  background: var(--glass);
  -webkit-backdrop-filter: blur(var(--blur-controls));
  backdrop-filter: blur(var(--blur-controls));
}
```

- [ ] **Step 4: Export + Imports verdrahten**

`packages/ui/package.json` — exports erweitern:

```json
"exports": {
  ".": "./src/index.ts",
  "./styles.css": "./src/styles.css",
  "./theme.css": "./src/theme.css"
}
```

`apps/web/src/main.tsx` und `apps/tv/src/main.tsx` — theme.css NACH styles.css importieren (Legacy bleibt bis Task 10):

```ts
import '@lolarr/ui/styles.css'
import '@lolarr/ui/theme.css'
```

- [ ] **Step 5: TV-HTMLs markieren + Tizen-CSS-Target**

In `apps/tv/index.html` und `apps/tv/tizen-index.html`: `<html lang="en">` → `<html lang="en" class="tv-ui">`.

`apps/tv/vite.tizen.config.ts` — im `build`-Block ergänzen (Chromium-M120-Floor, verhindert CSS-Downleveling auf es2017-Niveau):

```ts
build: {
  emptyOutDir: true,
  outDir: 'dist-tizen',
  target: 'es2017',
  cssTarget: 'chrome120',
  ...
```

- [ ] **Step 6: Verifikation**

Run: `moon run ui:test features:test ui:typecheck web:build tv:tizen-sync`
Expected: alles grün; beide Builds erzeugen CSS mit Inter-`@font-face` und Tailwind-Preflight. Kurzer Sichttest: `moon run web:dev` — App sieht unverändert aus (Legacy-CSS gewinnt noch), keine Konsolen-Fehler.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ui): add tailwind v4 foundation with abyss design tokens"
```

---

### Task 2: shadcn-Verdrahtung + Komponenten-Generierung

**Files:**
- Modify: `packages/ui/tsconfig.json`
- Modify: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/components.json`
- Create (generiert): `packages/ui/src/components/ui/shadcn/{button,input,dialog,tabs,badge,skeleton}.tsx`

**Interfaces:**
- Consumes: Tokens/Utilities aus Task 1.
- Produces: `cn(...inputs: ClassValue[]): string` aus `@ui/lib/utils`; pristine shadcn-Module unter `@ui/components/ui/shadcn/*` (Button mit `variant`/`size`-CVA, Input, Dialog-Familie, Tabs-Familie, Badge, Skeleton — Radix-basiert, ref-forwarding).

- [ ] **Step 1: `@ui`-Alias für tsc + vitest**

`packages/ui/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.react-app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tsbuildinfo",
    "baseUrl": ".",
    "paths": { "@ui/*": ["./src/*"] }
  },
  "include": ["src", "tests"]
}
```

`packages/ui/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@ui': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
})
```

- [ ] **Step 2: `cn`-Util + shadcn-Deps**

```bash
pnpm --filter @lolarr/ui add class-variance-authority clsx tailwind-merge lucide-react
```

`packages/ui/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: `packages/ui/components.json` anlegen**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/theme.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@ui/components",
    "ui": "@ui/components/ui/shadcn",
    "utils": "@ui/lib/utils",
    "lib": "@ui/lib",
    "hooks": "@ui/hooks"
  }
}
```

- [ ] **Step 4: Komponenten generieren**

```bash
cd packages/ui && pnpm dlx shadcn@latest add button input dialog tabs badge skeleton --yes --overwrite
```

Expected: sechs Dateien unter `packages/ui/src/components/ui/shadcn/`, Radix-Dependencies automatisch in `packages/ui/package.json`. Prüfen: `git status` zeigt KEINE Änderungen außerhalb von `packages/ui`. Stop-Bedingung: Legt die CLI Dateien woanders ab oder scheitert an den Aliasen, abbrechen und an den Controller melden (nicht manuell nachbauen).

- [ ] **Step 5: Verifikation + Commit**

Run: `moon run ui:test ui:typecheck web:build tv:tizen-sync`
Expected: grün (generierte Dateien werden noch nirgends importiert; typecheck erfasst sie über `include: src`).

```bash
git add -A && git commit -m "feat(ui): wire shadcn with pristine components under ui/shadcn"
```

---

### Task 3: Button/Input-Wrapper + `variant`-API für Actions

**Files:**
- Create: `packages/ui/src/components/ui/Button.tsx`, `packages/ui/src/components/ui/Input.tsx`
- Modify: `packages/ui/src/components/types.tsx`, `DefaultAction.tsx`, `DefaultTextInput.tsx`, `packages/ui/src/index.ts`
- Modify: `apps/tv/src/App.tsx` (`TvAction`, `TvTextInput`)
- Test: `packages/ui/tests/Button.test.tsx` (neu), bestehende Suiten

**Interfaces:**
- Consumes: shadcn `Button`/`Input` aus `@ui/components/ui/shadcn/*`, `cn` aus `@ui/lib/utils`.
- Produces: `ActionProps` erweitert um `variant?: 'primary' | 'ghost' | 'glass'` und `size?: 'md' | 'lg'` (Default `ghost`/`md`); Wrapper `Button` (props: `variant`, `size`, `className`, ref-forwarding, alle Button-HTML-Props) und `Input` als **einzige** von Screens/Apps genutzte Basiselemente. `DefaultAction`/`TvAction` rendern beide den Wrapper → identischer Look auf Web und TV. **API-Änderung dokumentieren:** Task-Report listet die neuen Props; Legacy-`className`-Durchreichung bleibt erhalten, bis die Wellen die Call-Sites migrieren.

- [ ] **Step 1: Failing Test schreiben** — `packages/ui/tests/Button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '../src/components/ui/Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders primary variant with primary classes', () => {
    render(<Button variant="primary">Play</Button>)
    const button = screen.getByRole('button', { name: 'Play' })
    expect(button.className).toContain('bg-primary')
  })

  it('appends the focused class for TV focus styling', () => {
    render(<Button className="focused">Play</Button>)
    expect(screen.getByRole('button').className).toContain('focused')
  })

  it('renders glass variant with glass-controls utility', () => {
    render(<Button variant="glass">Info</Button>)
    expect(screen.getByRole('button').className).toContain('glass-controls')
  })
})
```

- [ ] **Step 2: Test läuft rot** — Run: `pnpm --filter @lolarr/ui run test`
Expected: FAIL (`Button` existiert nicht).

- [ ] **Step 3: Wrapper implementieren**

`packages/ui/src/components/ui/Button.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { Button as ShadcnButton } from '@ui/components/ui/shadcn/button'
import { cn } from '@ui/lib/utils'

export type LolarrButtonVariant = 'primary' | 'ghost' | 'glass'
export type LolarrButtonSize = 'md' | 'lg'

const VARIANT_TO_SHADCN = {
  primary: 'default',
  ghost: 'outline',
  glass: 'outline',
} as const

const VARIANT_EXTRA: Record<LolarrButtonVariant, string> = {
  primary: '',
  ghost: 'bg-transparent hover:bg-surface-2',
  glass: 'glass-controls border-border hover:bg-surface-3',
}

const SIZE_TO_SHADCN = { md: 'default', lg: 'lg' } as const

type ButtonProps = Omit<ComponentProps<typeof ShadcnButton>, 'variant' | 'size'> & {
  variant?: LolarrButtonVariant
  size?: LolarrButtonSize
}

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  return (
    <ShadcnButton
      variant={VARIANT_TO_SHADCN[variant]}
      size={SIZE_TO_SHADCN[size]}
      className={cn(
        'transition-[transform,background-color,border-color] duration-[350ms] ease-out-expo',
        'focused:scale-[1.06] focused:border-ring focused:bg-surface-3',
        VARIANT_EXTRA[variant],
        className,
      )}
      {...props}
    />
  )
}
```

`packages/ui/src/components/ui/Input.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { Input as ShadcnInput } from '@ui/components/ui/shadcn/input'
import { cn } from '@ui/lib/utils'

export function Input({ className, ...props }: ComponentProps<typeof ShadcnInput>) {
  return (
    <ShadcnInput
      className={cn(
        'h-11 bg-surface border-border rounded-md transition-colors duration-[350ms] ease-out-expo',
        'focus-visible:ring-1 focus-visible:ring-ring',
        'focused:border-ring focused:bg-surface-2',
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Contract + Defaults umstellen**

`packages/ui/src/components/types.tsx` — `ActionProps` um die zwei Felder erweitern (Rest unverändert):

```tsx
export type ActionProps = {
  ariaLabel?: string
  children: ReactNode
  className?: string
  disabled?: boolean
  focusKey?: string
  onPress?: () => void
  size?: 'md' | 'lg'
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost' | 'glass'
}
```

`packages/ui/src/components/DefaultAction.tsx`:

```tsx
import { Button } from './ui/Button'
import type { ActionProps } from './types'

export function DefaultAction({
  ariaLabel,
  children,
  className,
  disabled,
  onPress,
  size,
  type = 'button',
  variant,
}: ActionProps) {
  return (
    <Button
      aria-label={ariaLabel}
      type={type}
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </Button>
  )
}
```

`packages/ui/src/components/DefaultTextInput.tsx`: `<input …>` durch den `Input`-Wrapper ersetzen, Props-Durchreichung identisch (alle bisherigen Attribute bleiben; nur das Element wird `Input`).

`packages/ui/src/index.ts` — zusätzlich exportieren:

```ts
export { Button } from './components/ui/Button'
export { Input } from './components/ui/Input'
```

`apps/tv/src/App.tsx` — `TvAction`: das rohe `<button>` durch den `Button`-Wrapper ersetzen; `useFocusable`-`ref` an `Button` durchreichen (shadcn-Button forwarded refs), `focused`-Klassen-Toggle bleibt:

```tsx
<Button
  ref={ref}
  type={type}
  variant={variant}
  size={size}
  aria-label={ariaLabel}
  className={cn(className, focused && 'focused')}
  disabled={disabled}
  onClick={onPress}
>
  {children}
</Button>
```

(`cn` aus `@lolarr/ui` re-exportieren: `export { cn } from './lib/utils'` in `packages/ui/src/index.ts`.) `TvTextInput` analog auf den `Input`-Wrapper.

- [ ] **Step 5: Tests grün + Gesamtverifikation**

Run: `pnpm --filter @lolarr/ui run test`, dann `moon run ui:test features:test ui:typecheck web:build tv:tizen-sync`
Expected: PASS. Buttons/Inputs erscheinen bereits im neuen Look (shadcn-Styles schlagen Legacy dort, wo Wrapper rendern).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(ui): route DefaultAction/TvAction through shadcn button wrapper with variant API"
```

---

### Task 4: Wrapper GlassDialog/PillTabs + Badge/Skeleton-Umbau

**Files:**
- Create: `packages/ui/src/components/ui/GlassDialog.tsx`, `packages/ui/src/components/ui/PillTabs.tsx`
- Modify: `packages/ui/src/components/StatusBadge.tsx`, `RequestStatusBadge.tsx`, `LoadingPanel.tsx`, `packages/ui/src/index.ts`
- Test: `packages/ui/tests/GlassDialog.test.tsx` (neu), bestehende Suiten anpassen

**Interfaces:**
- Consumes: shadcn `dialog`, `tabs`, `badge`, `skeleton`; `cn`.
- Produces:
  - `GlassDialog({ open, onClose, title, ariaLabel, children }: { open: boolean; onClose: () => void; title?: string; ariaLabel?: string; children: ReactNode })` — Radix-Dialog in Glass-Optik; Fokus-Trap aktiv (Spike in Task 5 validiert TV).
  - `PillTabs({ items, selectedId, onSelect, Action }: { items: Array<{ id: string; label: string }>; selectedId: string; onSelect: (id: string) => void; Action?: ActionComponent })` — **rendert Action-Buttons in Pill-Optik** (Norigin-sicher); nutzt Radix-Tabs NICHT für die Fokus-Logik, nur die Optik-Klassen. Fällt der Tabs-Teil des Spikes positiv aus, darf die Web-Variante später auf Radix-Tabs wechseln — Verhalten identisch.
  - `StatusBadge`/`RequestStatusBadge` rendern shadcn `Badge` mit Status-Token-Klassen.

- [ ] **Step 1: Failing Test** — `packages/ui/tests/GlassDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassDialog } from '../src/components/ui/GlassDialog'

afterEach(cleanup)

describe('GlassDialog', () => {
  it('renders children and title when open', () => {
    render(
      <GlassDialog open onClose={() => {}} title="Request seasons">
        <p>Body</p>
      </GlassDialog>,
    )
    expect(screen.getByText('Request seasons')).toBeDefined()
    expect(screen.getByText('Body')).toBeDefined()
  })

  it('calls onClose when dismissed via Escape', () => {
    const onClose = vi.fn()
    render(
      <GlassDialog open onClose={onClose} title="T">
        <p>Body</p>
      </GlassDialog>,
    )
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    render(
      <GlassDialog open={false} onClose={() => {}} title="T">
        <p>Body</p>
      </GlassDialog>,
    )
    expect(screen.queryByText('Body')).toBeNull()
  })
})
```

- [ ] **Step 2: rot laufen lassen** — `pnpm --filter @lolarr/ui run test` → FAIL.

- [ ] **Step 3: Implementierung**

`packages/ui/src/components/ui/GlassDialog.tsx`:

```tsx
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@ui/components/ui/shadcn/dialog'
import { cn } from '@ui/lib/utils'

export function GlassDialog({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        aria-label={ariaLabel}
        className={cn('glass rounded-lg border-border max-w-lg', className)}
      >
        {title ? <DialogTitle className="text-xl font-semibold">{title}</DialogTitle> : null}
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

`packages/ui/src/components/ui/PillTabs.tsx`:

```tsx
import { DefaultAction } from '../DefaultAction'
import type { ActionComponent } from '../types'
import { cn } from '@ui/lib/utils'

export function PillTabs({
  items,
  selectedId,
  onSelect,
  Action = DefaultAction,
  ariaLabel,
}: {
  items: Array<{ id: string; label: string }>
  selectedId: string
  onSelect: (id: string) => void
  Action?: ActionComponent
  ariaLabel?: string
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Action
          key={item.id}
          focusKey={`tab-${item.id}`}
          onPress={() => onSelect(item.id)}
          className={cn(
            'rounded-full px-5 h-9 text-sm',
            item.id === selectedId
              ? 'bg-primary text-primary-foreground'
              : 'bg-surface text-muted-foreground',
          )}
        >
          {item.label}
        </Action>
      ))}
    </nav>
  )
}
```

`StatusBadge.tsx` (Klassen-Map vollständig; `RequestStatusBadge` analog mit `request-status`-Werten `pending/approved/processing/available/declined/failed`):

```tsx
import type { Availability } from '@lolarr/domain'
import { Badge } from '@ui/components/ui/shadcn/badge'
import { cn } from '@ui/lib/utils'
import { labelForAvailability } from './availabilityLabels'

const AVAILABILITY_CLASSES: Record<Availability, string> = {
  available: 'text-status-available border-status-available/40 bg-status-available/10',
  partiallyAvailable: 'text-status-available border-status-available/40 bg-status-available/10',
  processing: 'text-status-processing border-status-processing/40 bg-status-processing/10',
  requested: 'text-status-requested border-status-requested/40 bg-status-requested/10',
  requestable: 'text-muted-foreground border-border bg-surface',
  unavailable: 'text-muted-foreground border-border bg-surface',
}

export function StatusBadge({ availability }: { availability: Availability }) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', AVAILABILITY_CLASSES[availability])}>
      {labelForAvailability(availability)}
    </Badge>
  )
}
```

(Weicht das tatsächliche `Availability`-Union ab, Map an die echten Werte anpassen — `packages/domain` ist die Quelle.)

`LoadingPanel.tsx` — Skeleton statt Spinner:

```tsx
import { Skeleton } from '@ui/components/ui/shadcn/skeleton'

export function LoadingPanel() {
  return (
    <section aria-label="Loading" className="flex flex-col gap-6 p-10">
      <Skeleton className="h-[40vh] w-full rounded-lg" />
      <div className="flex gap-4">
        <Skeleton className="h-56 w-40 rounded-md" />
        <Skeleton className="h-56 w-40 rounded-md" />
        <Skeleton className="h-56 w-40 rounded-md" />
        <Skeleton className="h-56 w-40 rounded-md" />
      </div>
      <p className="text-muted-foreground text-sm">Loading Lolarr</p>
    </section>
  )
}
```

`packages/ui/src/index.ts` — zusätzlich exportieren:

```ts
export { GlassDialog } from './components/ui/GlassDialog'
export { PillTabs } from './components/ui/PillTabs'
```

- [ ] **Step 4: Bestehende Tests anpassen** — Suiten, die auf Legacy-Klassen (`status-badge`, `loader-line`) oder alten Markup prüfen, auf Rolle/Text umstellen; jede Verhaltensänderung im Task-Report notieren.

- [ ] **Step 5: Verifikation + Commit**

Run: `moon run ui:test features:test ui:typecheck web:build tv:tizen-sync` → grün.

```bash
git add -A && git commit -m "feat(ui): add glass dialog and pill tabs wrappers, badge/skeleton rework"
```

---

### Task 5: Phase-0-Gate — Spike-Screen + UA-Verifikation ⛔ CHECKPOINT

**Files:**
- Create: `apps/tv/src/SpikeScreen.tsx`
- Modify: `apps/tv/src/App.tsx` (Env-Flag), `README.md` (Smoke-Checklist)

**Interfaces:**
- Consumes: `Button`, `GlassDialog`, `PillTabs` aus `@lolarr/ui`; Norigin-Hooks aus `apps/tv`.
- Produces: Gate-Ergebnis (dokumentiert in `docs/superpowers/specs/2026-07-05-lolarr-ui-foundation-design.md` unter „Phase 0 — Gate“ als Ergänzung).

- [ ] **Step 1: SpikeScreen implementieren** — `apps/tv/src/SpikeScreen.tsx`:

```tsx
import { useState } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation-react'
import { Button, GlassDialog, PillTabs, cn } from '@lolarr/ui'

function SpikeButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress })
  return (
    <Button ref={ref} className={cn(focused && 'focused')} onClick={onPress}>
      {label}
    </Button>
  )
}

export function SpikeScreen() {
  const { ref, focusKey } = useFocusable({ isFocusBoundary: true })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState('s1')

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="min-h-screen bg-background p-16 flex flex-col gap-8">
        <h1 className="text-3xl font-semibold">UI-Spike (Phase 0)</h1>
        <p className="text-muted-foreground text-sm break-all">{navigator.userAgent}</p>
        <div className="flex gap-4">
          <SpikeButton label="Dialog öffnen" onPress={() => setDialogOpen(true)} />
          <SpikeButton label="Fokus-Test B" />
          <SpikeButton label="Fokus-Test C" />
        </div>
        <PillTabs
          ariaLabel="Spike tabs"
          items={[
            { id: 's1', label: 'Staffel 1' },
            { id: 's2', label: 'Staffel 2' },
          ]}
          selectedId={tab}
          onSelect={setTab}
        />
        <GlassDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Glass-Dialog">
          <p className="text-muted-foreground">Fokus-Trap-Test: Pfeiltasten müssen zwischen den zwei Buttons wechseln.</p>
          <div className="flex gap-4">
            <SpikeButton label="Bestätigen" onPress={() => setDialogOpen(false)} />
            <SpikeButton label="Abbrechen" onPress={() => setDialogOpen(false)} />
          </div>
        </GlassDialog>
      </div>
    </FocusContext.Provider>
  )
}
```

- [ ] **Step 2: Env-Flag in `apps/tv/src/App.tsx`** — vor dem regulären Return:

```tsx
if (import.meta.env.VITE_UI_SPIKE === '1') {
  return <SpikeScreen />
}
```

- [ ] **Step 3: README-Smoke-Checklist erweitern** — im bestehenden Tizen-Smoke-Abschnitt drei Punkte ergänzen: (1) UA-String auf dem Spike-Screen ablesen und notieren (Erwartung `Chrome/120`), (2) Glass-Dialog öffnet/schließt flüssig, Fokus wandert per D-Pad im Dialog und kehrt zum Trigger zurück, (3) Pill-Tabs per D-Pad wechselbar.

- [ ] **Step 4: Verifikation Web** — `VITE_UI_SPIKE=1 moon run tv:dev` im Browser: Dialog + Tabs + Fokus per Pfeiltasten funktionieren.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tv): add phase-0 spike screen for norigin/radix gate"
```

- [ ] **Step 6: ⛔ STOP — User-Abnahme.** `VITE_UI_SPIKE=1 pnpm --filter ./apps/tv run tizen:sync` bauen, via Tizen Studio auf den S94C deployen (README Slice 5). Der User prüft die drei Checklist-Punkte. **Ergebnis (UA-String + bestanden/gescheitert je Kriterium) wird als „Phase-0-Ergebnis“-Absatz in die Spec geschrieben.** Bei Scheitern: Plan B aus der Spec aktivieren (Controller entscheidet, welche Folge-Tasks GlassDialog durch Eigenbau-Overlay ersetzen). Wellen ②-④ starten erst danach.

---

### Task 6: Welle ① — Auth-Trio (Gateway, Login, QuickConnect, Error)

**Files:**
- Modify: `packages/ui/src/components/GatewayPanel.tsx`, `LoginPanel.tsx`, `QuickConnectPanel.tsx`, `ErrorPanel.tsx`
- Modify: `packages/features/src/auth/GatewayScreen.tsx`, `LoginScreen.tsx`, `QuickConnectScreen.tsx` (nur falls dort Legacy-Klassen liegen)
- Modify: `packages/ui/src/styles.css` (Blöcke löschen)
- Test: bestehende ui-/features-Suiten

**Interfaces:**
- Consumes: `Button` (`variant="primary"`/`"ghost"`), `Input`, Tokens/Utilities.
- Produces: Auth-Flow komplett im neuen Look; Legacy-Klassen `login-panel`, `gateway-panel`, `quick-connect-panel`, `error-panel`, `login-fields`, `form-error`, `error-text`, `quick-connect-code`, `login-alt-action`, `primary-action`, `ghost-action` existieren weder in JSX noch in `styles.css`.

- [ ] **Step 1: Klassen-Mapping anwenden** — in den vier Panels die Legacy-Klassen durch diese Utilities ersetzen (Struktur/Logik unangetastet, nur `className` + Action-`variant`):

| Legacy | Neu |
|---|---|
| `login-panel`, `gateway-panel`, `quick-connect-panel`, `error-panel` (section) | `mx-auto my-[12vh] w-full max-w-md glass rounded-lg border p-10 flex flex-col gap-6` |
| `h2` darin | `text-2xl font-semibold tracking-tight` |
| `p` darin | `text-sm text-muted-foreground` |
| `login-fields` | `flex flex-col gap-4` |
| `login-fields label` | `flex flex-col gap-2 text-sm text-muted-foreground` |
| `form-error`, `error-text` | `text-sm text-danger` |
| `quick-connect-code` | `font-mono text-4xl tracking-[0.3em] text-center py-4` |
| `login-alt-action` | `text-center` |
| Action `className="primary-action"` | `variant="primary"` (kein className) |
| Action `className="ghost-action"` | `variant="ghost"` (kein className) |

- [ ] **Step 2: Legacy-CSS löschen** — alle Regeln zu den oben gelisteten Klassen (inkl. `:hover`/`.focused`-Varianten von `primary-action`/`ghost-action`) aus `packages/ui/src/styles.css` entfernen. Zusätzlich die `:root`-/`body`-/Basis-Blöcke (Zeilen 1-52: `:root`-Tokens, `*`, `body`, `button/input`, `#root/.app-shell`) löschen — ab jetzt liefert `theme.css` die Basis. `.lolarr-app` und alle übrigen Klassen bleiben unangetastet.
  Achtung: Andere Komponenten referenzieren noch `--radius`, `--line` etc. aus dem gelöschten `:root`. Damit Wellen ②-④ nicht vorzeitig brechen, am Anfang von `styles.css` einen Übergangs-Block einfügen, der die Legacy-Variablen auf die neuen Tokens mappt:

```css
:root {
  --bg: var(--background);
  --surface: var(--surface);
  --surface-2: var(--surface-2);
  --surface-3: var(--surface-3);
  --text: var(--foreground);
  --muted: var(--muted-foreground);
  --subtle: var(--muted-foreground);
  --line: var(--border);
  --accent: var(--foreground);
  --accent-2: var(--foreground);
  --danger: var(--danger);
  --shadow: 0 20px 90px rgb(0 0 0 / 0.45);
  --radius: 12px;
  --font: var(--font-sans);
}
```

  (Der Block fliegt in Task 10 mit der Datei raus. Nebeneffekt beabsichtigt: Alle noch nicht reworkten Screens werden sofort monochrom — Gelb verschwindet appweit mit Welle ①.)

- [ ] **Step 3: Tests + Builds** — `moon run ui:test features:test ui:typecheck web:build tv:tizen-sync` → grün; Tests, die Legacy-Klassen abfragen, auf Rolle/Text umstellen (dokumentieren).

- [ ] **Step 4: Web-Sichtprüfung** — `moon run web:dev`: Gateway → Login → QuickConnect im Glass-Look, keine gelben Akzente mehr.

- [ ] **Step 5: Commit + ⛔ TV-Abnahme**

```bash
git add -A && git commit -m "feat(ui): wave 1 auth screens in abyss glass look"
```

STOP: User-Smoke auf dem S94C (Login-Flow inkl. QuickConnect per D-Pad), erst danach Welle ②.

---

### Task 7: Welle ② — Home (Hero, Rails, Poster)

**Files:**
- Modify: `packages/ui/src/components/HeroPanel.tsx`, `MediaRail.tsx`, `MediaPosterButton.tsx`
- Modify: `packages/features/src/home/HomeScreen.tsx` (`home-header-row` u. a.)
- Modify: `packages/ui/src/styles.css` (Blöcke löschen)
- Test: bestehende Suiten

**Interfaces:**
- Consumes: `Button`, Tokens, `focused:`-Variante.
- Produces: Home im Spotlight-Look; Legacy-Klassen `hero-panel`, `hero-copy`, `hero-meta`, `hero-badge`, `media-rail`, `rail-heading`, `rail-scroll`, `media-card`, `poster-frame`, `poster-fallback`, `media-card-title`, `media-card-meta`, `poster-progress`, `poster-progress-fill`, `poster-subtitle`, `home-header-row` entfernt.

- [ ] **Step 1: Klassen-Mapping anwenden**

| Legacy | Neu |
|---|---|
| `hero-panel` | `relative min-h-[62vh] rounded-lg overflow-hidden flex items-end` — Backdrop-`img` als `absolute inset-0 h-full w-full object-cover`; darüber ein Scrim-`div` `absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent` |
| `hero-copy` | `relative z-10 max-w-xl p-12 flex flex-col gap-4` |
| `hero-copy h2` | `text-5xl font-semibold tracking-tight` |
| `hero-copy p` | `text-base text-muted-foreground line-clamp-3` |
| `hero-meta` | `flex items-center gap-3 text-sm text-muted-foreground` |
| `hero-badge` | ersetzen durch `StatusBadge`/shadcn-`Badge` (Task 4) |
| `poster-progress` | `absolute bottom-0 inset-x-0 h-1 bg-surface-3` |
| `poster-progress-fill` | `h-full bg-primary` |
| `media-rail` | `flex flex-col gap-3` |
| `rail-heading` | `flex items-baseline justify-between px-1` — `h2`: `text-lg font-semibold`; `span`: `text-xs text-muted-foreground` |
| `rail-scroll` | `flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` |
| `media-card` | `group relative w-40 shrink-0 rounded-md transition-transform duration-[350ms] ease-out-expo hover:scale-[1.06] focused:scale-[1.06] focused:outline focused:outline-2 focused:outline-ring` |
| `poster-frame` | `relative aspect-[2/3] overflow-hidden rounded-md bg-surface border` — `img`: `h-full w-full object-cover` |
| `poster-fallback` | `flex h-full items-center justify-center p-3 text-center text-sm text-muted-foreground` |
| `media-card-title` | `mt-2 truncate text-sm font-medium` |
| `media-card-meta` | `text-xs text-muted-foreground flex items-center gap-2` |
| `home-header-row` | `flex items-center justify-between gap-4` |

- [ ] **Step 2: Legacy-CSS-Blöcke der Welle löschen** (alle Klassen aus Step 1 inkl. Hover/Focused-Varianten).

- [ ] **Step 3: Tests + Builds** — Standard-Verifikation; angepasste Tests dokumentieren.

- [ ] **Step 4: Web-Sichtprüfung** — Hero mit Scrim, Rails scrollen, Fokus-Zoom via Tab/`.focused`.

- [ ] **Step 5: Commit** — `feat(ui): wave 2a home spotlight hero and rails`. (TV-Abnahme erfolgt gebündelt nach Task 8.)

---

### Task 8: Welle ② — Detail (Backdrop-Hero, Glass-Panel, Staffeln, Request-Dialog)

**Files:**
- Modify: `packages/ui/src/components/DetailPanel.tsx`, `EpisodeList.tsx`, `SeasonSelector.tsx`, `SeasonRequestPicker.tsx`
- Modify: `packages/features/src/detail/DetailScreen.tsx`
- Modify: `packages/ui/src/styles.css` (Blöcke löschen)
- Test: `packages/ui/tests/EpisodeList.test.tsx` u. a. anpassen

**Interfaces:**
- Consumes: `GlassDialog`, `PillTabs`, `Button`, `StatusBadge`.
- Produces: Detail-Screen im neuen Look; `SeasonSelector` rendert `PillTabs`; `SeasonRequestPicker` rendert `GlassDialog` statt `season-picker-backdrop`-Eigenbau. Legacy-Klassen `detail-panel`, `detail-backdrop`, `detail-content`, `detail-grid`, `detail-poster`, `season-selector`, `season-button`, `episode-*`, `season-picker*`, `season-option`, `request-error` entfernt.

- [ ] **Step 1: `SeasonSelector` auf `PillTabs` umstellen** (Signatur bleibt):

```tsx
import { PillTabs } from './ui/PillTabs'
import type { ActionComponent } from './types'

type SeasonSelectorProps = {
  Action: ActionComponent
  seasons: Array<{ id: string; name: string }>
  selectedId: string
  onSelect: (id: string) => void
}

export function SeasonSelector({ Action, seasons, selectedId, onSelect }: SeasonSelectorProps) {
  return (
    <PillTabs
      ariaLabel="Seasons"
      Action={Action}
      items={seasons.map((s) => ({ id: s.id, label: s.name }))}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}
```

- [ ] **Step 2: `SeasonRequestPicker` auf `GlassDialog`** — äußeres `div.season-picker-backdrop` + `section.season-picker` ersetzen durch `<GlassDialog open onClose={onClose} title="Request seasons" ariaLabel="Request seasons">…</GlassDialog>`; Staffel-Liste: `ul` → `flex flex-col gap-2 max-h-[50vh] overflow-y-auto`; `season-option` → Action mit `className={cn('justify-between rounded-md', selected && 'bg-surface-3')}`; Fehlertext → `text-sm text-danger`; Aktionszeile `season-picker-actions` → `flex gap-3 justify-end pt-2`, Bestätigen-Action `variant="primary"`, Cancel `variant="ghost"`.

- [ ] **Step 3: Detail-Mapping**

| Legacy | Neu |
|---|---|
| `detail-panel` | `flex flex-col gap-8` |
| `detail-backdrop` | `relative min-h-[48vh] rounded-lg overflow-hidden` + Scrim wie Hero (Task 7) |
| `detail-content` | `relative z-10 p-12 flex flex-col gap-4 max-w-2xl` — `h2`: `text-4xl font-semibold tracking-tight`; `p`: `text-muted-foreground` |
| `detail-grid` | `grid grid-cols-[240px_1fr] gap-8 items-start` |
| `detail-poster img` | `rounded-md border aspect-[2/3] object-cover w-full` |
| `episode-list` | `flex flex-col gap-2` |
| `episode-row` | `grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-md border bg-surface p-4 transition-colors duration-[350ms] ease-out-expo hover:bg-surface-2 focused:bg-surface-2` |
| `episode-number` | `text-sm text-muted-foreground w-8` |
| `episode-info` | `flex flex-col gap-1` |
| `episode-overview` | `text-sm text-muted-foreground line-clamp-2` |
| `episode-played` | `text-status-available` |
| `episode-runtime` | `text-xs text-muted-foreground` |
| `episode-play` (Action) | `variant="glass"` |

- [ ] **Step 4: Legacy-CSS-Blöcke löschen, Tests anpassen, Standard-Verifikation.**

- [ ] **Step 5: Commit + ⛔ TV-Abnahme Welle ②**

```bash
git add -A && git commit -m "feat(ui): wave 2b detail screen with glass panel and season dialog"
```

STOP: User-Smoke auf S94C — Home-Rails per D-Pad, Detail öffnen, Staffel wechseln, Request-Dialog per D-Pad bedienen (Kernkriterium aus dem Spike, jetzt im echten Flow).

---

### Task 9: Welle ③ — Search, LibraryDetail, Requests

**Files:**
- Modify: `packages/ui/src/components/SearchBar.tsx`, `RequestList.tsx`
- Modify: `packages/features/src/search/SearchScreen.tsx`, `library/LibraryDetailScreen.tsx`, `requests/RequestsScreen.tsx`
- Modify: `packages/ui/src/styles.css` (Blöcke löschen)

**Interfaces:**
- Consumes: `Input`, `Button`, `RequestStatusBadge` (Task 4), Grid-Muster aus Task 7.
- Produces: Legacy-Klassen `search-bar`, `search-grid`, `library-detail*`, `request-list`, `request-title`, `request-meta`, `empty-state`, `nav-badge` entfernt.

- [ ] **Step 1: Mapping anwenden**

| Legacy | Neu |
|---|---|
| `search-bar` | `flex gap-3 items-center` — Input übernimmt Feld-Styling |
| `search-grid` | `grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4` |
| `library-detail` | `flex flex-col gap-8` |
| `library-detail-content` | `flex flex-col gap-4 max-w-2xl` |
| `library-detail-meta` | `flex items-center gap-3 text-sm text-muted-foreground` |
| `library-detail-actions` | `flex gap-3` (Actions via `variant`) |
| `request-list` | `flex flex-col gap-3` |
| `request-list ul` | `flex flex-col gap-2` |
| `request-list li` | `grid grid-cols-[1fr_auto] items-center gap-4 rounded-md border bg-surface p-4` |
| `request-title` | `font-medium truncate` |
| `request-meta` | `text-xs text-muted-foreground flex gap-2 items-center` |
| `request-list small` | `text-xs text-muted-foreground` |
| `empty-state` | `rounded-lg border border-dashed p-10 text-center text-muted-foreground` |
| `nav-badge` | `ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground` |

- [ ] **Step 2: Legacy-CSS-Blöcke löschen, Tests anpassen, Standard-Verifikation.**

- [ ] **Step 3: Commit + ⛔ TV-Abnahme**

```bash
git add -A && git commit -m "feat(ui): wave 3 search, library detail and requests rework"
```

STOP: User-Smoke S94C (Suche per TV-Tastatur, Request-Liste, Badges).

---

### Task 10: Welle ④ — Player, Toasts, AppFrame + Legacy-CSS-Abschied

**Files:**
- Modify: `packages/ui/src/components/PlayerControls.tsx`, `AutoplayOverlay.tsx`, `ToastStack.tsx`, `AppFrame.tsx`
- Modify: `packages/features/src/player/PlayerScreen.tsx` (Klassen), `apps/tv/src/App.tsx` (`TvShell`-Klassen falls nötig)
- Delete: `packages/ui/src/styles.css` + Export + Imports
- Test: `packages/ui/tests/playerControls.test.tsx`, `ToastStack.test.tsx`, `AutoplayOverlay.test.tsx` anpassen

**Interfaces:**
- Consumes: `GlassDialog`, `Button` (`variant="glass"`), Tokens.
- Produces: komplette App ohne `styles.css`; `AutoplayOverlay` als Glass-Dialog; Player-Leiste in `glass-controls`.

- [ ] **Step 1: Player-Mapping**

| Legacy | Neu |
|---|---|
| `player-screen` | `relative h-screen w-screen bg-black` |
| `player-surface`, `player-video`, `avplay-surface` | `absolute inset-0 h-full w-full` (Video `object-contain`) |
| `player-controls` | `absolute inset-x-0 bottom-0 z-10 glass-controls border-t p-6 flex flex-col gap-4 opacity-0 translate-y-2 transition-[opacity,transform] duration-[350ms] ease-out-expo pointer-events-none` |
| `player-controls.visible` | `opacity-100 translate-y-0 pointer-events-auto` (via `cn(visible && '…')`) |
| `player-controls-top` / `player-title` | `flex items-center justify-between` / `text-lg font-medium truncate` |
| `player-controls-bottom` | `flex items-center gap-4` |
| `player-seekbar` | Track: `relative h-1.5 w-full rounded-full bg-surface-3 focused:h-2.5 transition-all duration-[350ms] ease-out-expo`; Fill: `absolute inset-y-0 left-0 rounded-full bg-primary` |
| `player-buttons` | `flex items-center gap-3` (Actions `variant="glass"`) |
| `player-time` | `text-sm text-muted-foreground tabular-nums` |
| `player-spinner` | `Skeleton`-basiert oder `animate-pulse`-Kreis `size-12 rounded-full border-2 border-border border-t-ring animate-spin` |
| `autoplay-overlay` | ersetzen durch `GlassDialog` (`title` = "Next episode", Countdown als `text-muted-foreground`, Actions primary/ghost) — Props/Verhalten (`secondsLeft`, `onPlayNow`, `onCancel`) unverändert |
| `toast-stack` | `fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm` |
| `toast` | `glass rounded-md border p-4 border-l-4 text-sm` |
| `toast-<kind>` | `border-l-status-<kind>` (available/approved/declined/failed/requested → Status-Tokens) |
| `app-shell` / `lolarr-app` | `min-h-svh` / `mx-auto w-full max-w-[1680px] min-h-svh px-8 flex flex-col gap-10` |
| `topbar` | `flex items-center justify-between py-6` — `h1`: `text-xl font-semibold tracking-tight` |
| `topbar-actions` | `flex items-center gap-2` |
| `eyebrow` | `text-xs uppercase tracking-[0.2em] text-muted-foreground` |
| `user-chip` | `rounded-full bg-surface-2 px-3 py-1 text-sm` |

- [ ] **Step 2: `styles.css` löschen** — Datei entfernen, Export aus `packages/ui/package.json` streichen, Imports aus beiden `main.tsx` entfernen. `grep -rn "styles.css\|primary-action\|media-card\|season-picker" packages apps --include='*.ts*'` → 0 Treffer (außer dist/vendored).

- [ ] **Step 3: Tests anpassen + Standard-Verifikation** (inkl. `tv:typecheck`).

- [ ] **Step 4: Commit + ⛔ TV-Abnahme Welle ④**

```bash
git add -A && git commit -m "feat(ui): wave 4 player, toasts and app frame; drop legacy stylesheet"
```

STOP: User-Smoke S94C — kompletter Durchstich: Login → Home → Detail → Playback → Player-Controls per D-Pad → Autoplay-Dialog → Toast.

---

### Task 11: Doku + Gesamt-Verifikation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-05-lolarr-ui-foundation-design.md` (Phase-0-Ergebnis, falls noch nicht eingetragen)

- [ ] **Step 1: README-Abschnitt „UI-Architektur“** ergänzen: Tokens in `packages/ui/src/theme.css`; shadcn-Regel (pristine unter `components/ui/shadcn/`, Update-Kommando `pnpm dlx shadcn@latest add <name> --yes --overwrite`, Anpassungen nur in Wrappern); `variant`-API der Actions; `focused:`-Variante für TV-Fokus; Browser-Floor Tizen 9/M120.

- [ ] **Step 2: Gesamt-Verifikation**

```bash
moon run ui:test features:test ui:typecheck features:typecheck web:typecheck tv:typecheck web:build tv:build tv:tizen-sync
moon run ui:lint web:lint tv:lint
```

Expected: alles grün.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: document ui architecture, shadcn update rule and tv floor"
```
