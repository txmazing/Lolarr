# Lolarr — Web-Pfeiltasten-Navigation + Scroll-Polish (Design)

**Datum:** 2026-07-06
**Status:** Freigegeben (Brainstorming), bereit für Implementierungsplan

## Ziel

Im Web-Build (`apps/web`) mit den Pfeiltasten navigierbar machen — als **additive** Ergänzung zur Maus, die jederzeit gleichberechtigt bleibt (Desktop Maus+Tastatur, **kein** 10-Foot/TV-Browser-Ziel). Gleichzeitig das automatische Scroll-Verhalten **insgesamt** (Web **und** TV) über einen geteilten Helper polieren: modalitäts-bewusst, konsistenter Anker, Peek, smooth mit `prefers-reduced-motion`.

## Kontext & Ausgangslage

- Spatial Navigation (`@noriginmedia/norigin-spatial-navigation-*`) ist heute **TV-exklusiv**. `init()` nur in `apps/tv/src/spatial-navigation.ts`, aufgerufen aus `apps/tv/src/main.tsx`.
- Der **Injection-Seam existiert bereits**: `LolarrApp` (`packages/features/src/app.tsx`) nimmt `Action`, `TextInput`, `Shell`, `playerPlatform`. Web injiziert heute nur `DefaultAction`; TV injiziert `TvAction` + `TvTextInput` + `TvShell` + `playerPlatform`.
- Die **CSS-Schicht ist schon plattform-agnostisch**: `packages/ui/src/theme.css` reagiert auf `:focus-visible` (Web-Tastatur) **und** `.focused` (TV-D-pad) — Card-Morph, Ringe etc. sind fertig.
- `OverlayScope` (`packages/ui/src/components/ui/OverlayScope.tsx`) ist bereits per Context injizierbar (`OverlayScopeProvider`/`useOverlayScope`, Default = Passthrough). TV injiziert `TvOverlayScope` als Norigin-Fokus-Boundary; Web tut das noch nicht (Passthrough).
- Heutiges Auto-Scroll: nur TV, lokale Funktion `scrollFocusedElementIntoView` in `apps/tv/src/App.tsx` — `scrollIntoView({ block:'nearest', inline:'nearest' })` in `requestAnimationFrame`, kein Smooth, kein konsistenter Anker, kein Peek.

### Bestätigte API-Fakten (Recherche)

- Norigin **v4 core** `init(...)` unterstützt `shouldFocusDOMNode`, `domNodeFocusOptions`, `shouldUseNativeEvents`, `throttle`, `throttleKeypresses`, `distanceCalculationMethod`, `useGetBoundingClientRect`.
- **core** exportiert u. a. `init`, `setFocus`, `pause`, `resume`, `getCurrentFocusKey`, `doesFocusableExist`, `navigateByDirection`.
- **react** exportiert `useFocusable` (Config: `focusKey`, `focusable`, `onEnterPress`, `onArrowPress`, `onFocus`, `onBlur`, `isFocusBoundary`, `trackChildren`, …; Result: `ref`, `focused`, `focusSelf`) und `FocusContext`.
- Web-Dev/Preview-Port: **5199** (`.claude/launch.json`, `--strictPort`). TV: 5299. API: 4000.

## Grundsatz-Entscheidung

**Norigin im Web über den bestehenden Seam wiederverwenden** (Ansatz Ⓐ) — nicht eigene Web-Spatial-Nav bauen. Begründung: der Seam wurde exakt dafür entworfen, die CSS-Schicht ist bereits agnostisch, TV+Web bleiben **ein** System (kein Drift), Geometrie/Fokus-Graph sind battle-tested. Der Scroll-Helper wird **geteilt** (Web+TV), erfüllt „insgesamt".

## Architektur

Web injiziert plattform-eigene Fokus-Komponenten (Spiegel der TV-Seite), plus einen **geteilten** Scroll-/Modalitäts-Helper in `packages/ui`, den beide Plattformen nutzen.

```
apps/web/src/
  spatial-navigation.ts     (NEU) init() mit Web-Config
  main.tsx                  (MOD) init vor render aufrufen
  App.tsx                   (MOD) Action/TextInput/Shell injizieren
  focus/
    WebAction.tsx           (NEU) useFocusable + Maus↔Tastatur-Sync + Scroll
    WebShell.tsx            (NEU) Fokus-Root + WebOverlayScope-Provider + Modalitäts-Tracking
    WebTextInput.tsx        (NEU) Suchfeld: pause()/resume() beim Editieren

packages/ui/src/
  lib/focusScroll.ts        (NEU, GETEILT) scrollFocusedIntoView + Modalitäts-Tracker
  theme.css                 (MOD) scroll-padding auf Rail-/Vertikal-Container
  components/HeroPanel.tsx   (MOD) data-focus-scroll-region am Wrapper
  components/DetailPanel.tsx (MOD) data-focus-scroll-region am Wrapper

apps/tv/src/
  App.tsx                   (MOD) TvAction nutzt geteilten Helper statt lokaler Funktion
```

`packages/ui` bekommt **keine** Norigin-Abhängigkeit — `focusScroll.ts` ist reines DOM (kein Norigin-Import). Norigin bleibt in `apps/web` + `apps/tv`. `apps/web/package.json` bekommt `@noriginmedia/norigin-spatial-navigation-core` + `-react` als Dependency (bereits im Workspace vorhanden).

## Komponenten

### 1. `apps/web/src/spatial-navigation.ts` (NEU)

**Verantwortung:** Norigin für Web initialisieren.

```ts
init({
  debug: false,
  visualDebug: false,
  throttle: 0,
  throttleKeypresses: true,                 // gehaltene Pfeiltaste sauber wiederholen
  shouldFocusDOMNode: true,                 // echter DOM-Fokus → :focus-visible + a11y + natives Enter
  domNodeFocusOptions: { preventScroll: true }, // Norigin scrollt NICHT selbst — wir kontrollieren Scroll
  distanceCalculationMethod: 'corners',
})
```

Exportiert `initSpatialNavigation()`; Aufruf aus `main.tsx` vor `createRoot(...).render(...)`.

### 2. `apps/web/src/focus/WebAction.tsx` (NEU) — `ActionComponent`

**Verantwortung:** Fokussierbares Web-Pendant zu `DefaultAction`/`TvAction`. Erfüllt `ActionProps` (`packages/ui/src/components/types.tsx`).

Verhalten:
- `useFocusable({ focusKey, focusable: !disabled, onEnterPress, onFocus })`.
- Rendert `<Button … className={cn(className, focused && 'focused')} onClick={onPress}>`. Klick bleibt nativ. `shouldFocusDOMNode` lässt zusätzlich `:focus-visible` aufleuchten.
- **Maus↔Tastatur-Sync:** `onPointerEnter` → `setFocus(focusKey)`, damit Norigins „aktueller" Knoten der Maus folgt; Pfeile machen dort weiter, wo die Maus zuletzt war. (Nur wenn `focusKey` gesetzt ist.)
- **Scroll bei Fokus:** in `onFocus` (oder `useEffect` auf `focused`) → `scrollFocusedIntoView(ref.current, { smooth: true })`. Der Modalitäts-Guard im Helper verhindert Scrollen bei Maus-Hover.
- `autoFocus` → `focusSelf()` beim Mount (Overlay-Primärbuttons), identisch zu TV.

### 3. `apps/web/src/focus/WebShell.tsx` (NEU) — `ShellComponent`

**Verantwortung:** Fokus-Root + Overlay-Boundary + Modalitäts-Tracking; Web-Pendant zu `TvShell`.

- `useFocusable({ focusKey: 'APP', trackChildren: true })`, wrappt Kinder in `FocusContext.Provider` und `OverlayScopeProvider value={WebOverlayScope}`.
- Installiert einmalig das Modalitäts-Tracking (`installModalityTracking()` aus `focusScroll.ts`) und räumt beim Unmount auf.
- **Kein Streu-Ring für Maus-Nutzer:** `WebShell` seedet den Fokus **nicht** beim Mount. Stattdessen ein einmaliger `keydown`-Listener: der **erste** Pfeildruck (wenn noch kein Fokus gesetzt, via `getCurrentFocusKey()`/`doesFocusableExist`) seedet Fokus auf ein sinnvolles erstes Element (erste Rail-Card bzw. erstes Nav-Item), danach normale Norigin-Navigation. Reine Maus-Session bleibt ring-frei.
- Enthält `WebOverlayScope` (analog `TvOverlayScope`): `useFocusable({ isFocusBoundary: true, trackChildren: true })` → Pfeil-Navigation bleibt im offenen Dialog gefangen (ergänzt Base UIs Tab-Trap).

### 4. `apps/web/src/focus/WebTextInput.tsx` (NEU) — `TextInputComponent`

**Verantwortung:** Suchfeld/Formularfelder, bei denen Pfeile den **Cursor** bewegen, nicht das Grid.

- `useFocusable({ focusKey, onEnterPress })`; rendert `<Input … />`.
- **Beim Fokus** (`onFocus`) → `pause()` (Norigin-Navigation pausiert), sodass Pfeile/Home/End/Backspace nativ den Cursor bewegen und Tippen die Kacheln nie verschiebt.
- **Beim Blur** (`onBlur`) → `resume()`.
- Feld verlassen: `Tab`/`Shift+Tab` (nativ) oder `Escape` (blurt → `resume()`). `submitOnEnter`/`nextFocusKey` wie im bestehenden `TextInputProps`-Kontrakt bedient (Enter → submit bzw. nächstes Feld).

### 5. `packages/ui/src/lib/focusScroll.ts` (NEU, GETEILT)

**Verantwortung:** Reines-DOM Scroll- + Modalitäts-Modul, von `WebAction` **und** `TvAction` genutzt. Kein Norigin-Import.

Exporte:
- `isKeyboardModality(): boolean` — modul-weites Flag.
- `installModalityTracking(): () => void` — fügt `keydown` (→ Flag `true`) und `pointerdown`/`pointermove` (→ Flag `false`) Listener hinzu; gibt Cleanup zurück. Startwert `false` (kein Scroll vor der ersten Taste). Auf TV existieren keine Pointer-Events → Flag bleibt nach erster Fernbedienungstaste `true`.
- `scrollFocusedIntoView(el: Element | null, opts?: { smooth?: boolean }): void`:
  - Guard: `if (!el || !isKeyboardModality()) return` — Maus-Hover scrollt nie.
  - `behavior = opts?.smooth && !prefersReducedMotion() ? 'smooth' : 'auto'` (`prefersReducedMotion` via `matchMedia('(prefers-reduced-motion: reduce)')`).
  - In `requestAnimationFrame`:
    - `const region = el.closest('[data-focus-scroll-region]')`
    - **Hero:** `if (region) region.scrollIntoView({ block: 'start', behavior })` → ganzer Hero sichtbar (respektiert `scroll-padding-block-start` = Nav-Höhe).
    - **Sonst:** `el.scrollIntoView({ block: 'center', inline: 'nearest', behavior })` → Reihe zentriert (bei gleicher Reihe links/rechts ändert sich die Vertikale nicht → yankt nur bei Reihenwechsel); horizontaler Peek über `scroll-padding-inline` der Rail.
  - `try/catch`-Fallback `scrollIntoView(false)` für alte Engines (Tizen), wie heute.

### 6. `packages/ui/src/theme.css` (MOD)

- **Rail-Scroll-Container** (MediaRail-Scroll-`div`): stabile Klasse (z. B. `.lolarr-rail`) + `scroll-padding-inline: <lead-in>` (Peek der Nachbar-Card; Wert an bestehendes `pl-12`/`pr-12`-Padding angelehnt). MediaRail bekommt die Klasse.
- **Vertikaler Scroll-Container** (das Element, das die Seite vertikal scrollt — im Plan verifizieren: Dokument/`html` vs. App-Shell-Container): `scroll-padding-block-start: <Nav-Höhe + Gap>`, damit fokussierte Reihen/Hero nie unter der fixen Top-Nav landen. Nav-Höhe als CSS-Variable, falls vorhanden.
- **`scroll-behavior` bleibt raus aus CSS** — `behavior` kommt aus JS (reduced-motion an einer Stelle, Maus-Freilauf ungestört).

### 7. `HeroPanel.tsx` / `DetailPanel.tsx` (MOD)

- Root-Wrapper bekommt `data-focus-scroll-region`, damit Fokus auf Hero-CTAs (Abspielen / Mehr Infos / Merken) den ganzen Hero nach oben holt statt den Button zu zentrieren.

### 8. `apps/tv/src/App.tsx` (MOD) — TV-Vereinheitlichung

- `TvAction` (und `TvTextInput`) rufen den geteilten `scrollFocusedIntoView(el, { smooth: false })` (instant) statt der lokalen `scrollFocusedElementIntoView`. Lokale Funktion entfällt.
- TV verhält sich wie bisher (immer Scroll), da ohne Pointer das Modalitäts-Flag `true` bleibt. Kein Verhaltensbruch außer dem neuen Anker/Peek — deshalb die TV-On-Device-Abnahme.

## Datenfluss / Interaktion

1. **Erste Pfeiltaste** → `WebShell`-keydown seedet Fokus auf erstes sinnvolles Element → `WebAction.onFocus` → `scrollFocusedIntoView`.
2. **Pfeil weiter** → Norigin bewegt Fokus (Geometrie) → `.focused` + echter DOM-Fokus (`:focus-visible`) → Scroll (zentriert / Hero-ganz).
3. **Maus-Hover** → `pointerenter` → `setFocus` (Sync) → **kein** Scroll (Modalitäts-Guard). Klick → `onPress` nativ.
4. **Enter/Space** auf fokussierter Card → `onEnterPress`/nativer Klick → `onPress`.
5. **Suchfeld fokussiert** → `pause()` → Pfeile = Cursor; `Escape`/`Tab`/Blur → `resume()`.
6. **Dialog offen** → `WebOverlayScope`-Boundary → Pfeile bleiben im Dialog.

## Edge Cases

- **Maus-only-Session:** kein Fokus-Ring bis zur ersten Taste (kein Mount-Seed).
- **reduced-motion:** `behavior:'auto'` (instant) auf beiden Plattformen.
- **Innerhalb einer Reihe navigieren:** `block:'center'` no-op vertikal (Element bleibt in derselben Reihe) → kein vertikales Yanken; nur horizontaler Peek.
- **Hero am Seitenanfang:** Fokus auf Hero-CTA → ganzer Hero oben; Fokus auf erste Content-Reihe darunter → Reihe zentriert (Hero scrollt erwartungsgemäß weg).
- **Tizen alte Engine:** `try/catch`-Fallback bleibt erhalten.
- **`packages/ui` bleibt Norigin-frei:** `focusScroll.ts` importiert kein Norigin; Modalitäts-Guard ist reines DOM.

## Testing

- **Unit (vitest/jsdom), `packages/ui/tests/focusScroll.test.ts`:**
  - Modalitäts-Tracker: `keydown` → `isKeyboardModality()===true`; `pointerdown` → `false`; Startwert `false`.
  - `scrollFocusedIntoView` mit gemocktem `Element.prototype.scrollIntoView` + gemocktem `matchMedia`:
    - Kein Aufruf bei Pointer-Modalität.
    - Element in `[data-focus-scroll-region]` → `{ block:'start' }`.
    - Sonst → `{ block:'center', inline:'nearest' }`.
    - `smooth:true` + reduced-motion → `behavior:'auto'`; `smooth:true` ohne reduced-motion → `behavior:'smooth'`; `smooth:false` → `behavior:'auto'`.
- **Integration/manuell (Web-Preview, Port 5199):** echte Pfeil-Traversierung Home-Rails/Nav/Hero/Detail, Maus↔Tastatur-Sync, Suchfeld-Cursor, Dialog-Trap, Scroll-Gefühl. Norigin-Geometrie ist Integration → im Browser verifizieren.
- **TV-On-Device-Abnahme:** Scroll-Gefühl (Anker/Peek/instant) am echten Tizen prüfen, da der geteilte Helper `TvAction` ersetzt.
- `WebAction`/`WebShell`/`WebTextInput` sind dünne Norigin-Verdrahtung (wie `TvAction` heute ohne Unit-Test) → Browser-verifiziert; testbare Logik lebt im geteilten Helper.

## Out of Scope

- Volle 10-Foot-/Back-Tasten-Web-Experience (bewusst nicht — Desktop Maus+Tastatur).
- Scroll-Snap (bleibt aus; Maus-Freilauf bleibt frei).
- Gamepad-Eingabe.
- Änderungen am TV-Fokusverhalten über den Scroll-Helper-Tausch hinaus.
- Refactoring von `TvAction`/`TvTextInput` über den Helper-Tausch hinaus.

## Verifikation-Kommandos

- `moon run ui:test` (neuer `focusScroll`-Test grün, bestehende 69 grün)
- `moon run :typecheck` grün, `moon run :lint` sauber (keine neuen Verstöße)
- Web-Preview-Smoke via Preview-Tools auf Port 5199
