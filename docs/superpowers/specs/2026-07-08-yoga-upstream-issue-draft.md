# Draft: Upstream-Issue an plexinc/react-lightning (Yoga-Flexbox)

**Status:** ENTWURF — nicht eingereicht. Einreichen ist User-Entscheid
(öffentliche Aktion). Repo: https://github.com/plexinc/react-lightning
(aktiv, wenige offene Issues). Vor dem Einreichen: Minimal-Repro als
öffentliches Repo/StackBlitz aus dem Spike extrahieren.

---

**Title:** Flexbox plugin: row renders empty when a width-animated child
at index ≥ 8 gains focus (index-dependent, not timing-dependent)

**Packages:** `@plextv/react-native-lightning` 0.4.2,
`@plextv/react-lightning-plugin-flexbox` 0.4.2, `@lightningjs/renderer`
3.0.1, react 19.2.3, vite 8.1.3, flexbox plugin with
`{ useWebWorker: false }`.

**Setup:** A horizontal row (`flexDirection: 'row'`, `gap`) of 20
fixed-height cards inside a flex column. The focused card animates its
`width` 240→640 (transition prop). Focus moves with arrow keys.

**Expected:** Row re-layouts as the focused card grows; siblings shift.

**Actual:** As soon as the focused index reaches ≥ 8 (of 20), the entire
row renders empty (all children disappear). Bisection shows the trigger
is the focus **index**, not elapsed time, animation state, or input
rate — stepping slowly reproduces it at exactly the same index.
Reducing the row to fewer items shifts the failing index accordingly.
The row never recovers until re-mount.

**Workaround:** Take the cards out of the flex flow entirely (absolute
positioning with precomputed x offsets); only the static page scaffold
keeps using Yoga. With that, the same scene runs at the expected frame
times on a Samsung S94C (Tizen), so this looks like a layout-plugin
defect rather than a renderer/perf problem.

**Environment:** Samsung S94C (Tizen 7), packaged web app (file://
origin — hence `useWebWorker: false`, blob/module workers are unreliable
there); also reproducible in desktop Chrome dev build.

**Questions:** Is this a known limitation of the flexbox plugin's
incremental relayout? Happy to provide a minimal repro repo.

---

**Repro-Quelle intern:** Branch `spike/tv-rn-lightning`, Commits
08769f6 (RN-Konvertierung, Bug sichtbar) → a043d3a (Absolut-Workaround);
Bisektionsprotokoll im Ledger (.git/sdd/progress.md, GATE 1).
