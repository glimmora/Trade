# Trade — Status

Updated by QA (integration read-through, 2026-11-21). Nothing here claims a
CI run: **CI has never run** — the repository does not exist yet (see
"Push readiness" below), no lockfile has been generated, and no build, test,
lint, or e2e step has executed anywhere. All verdicts below are from reading
the code, not from running it.

## Milestones — honest status

- [ ] **M1 — Scaffold + CI/CD green + deploy "hello chart" to Pages.**
  Scaffold, workflows, Pages deploy config, and the app shell are in place,
  but CI has never run and the repo does not exist yet. Not done.
- [ ] **M2 — Providers + real candles for all 3 pairs + provider
  dropdown + accuracy cross-check.**
  The providers package is complete (9 adapters, registry, normalizers,
  fixtures, cross-check, unit tests) but **nothing in `apps/web` imports
  it** — no data is fetched, no candles reach the chart, the connection
  status never leaves "connecting". Provider dropdown exists and is
  filtered per symbol. Not done.
- [ ] **M3 — Chart types, timeframes, live updates, dark/light theme,
  responsive shell.**
  Chart engine is complete (7 chart types, linear/log/percentage scales,
  crosshair legend, live-tick merge, layouts, themes) and is correctly
  wired by `ChartHost` — but it is always fed an empty candle array, so
  it renders "No data". Theme and responsive shell work; multi-chart
  panels mirror the same symbol/timeframe. Partial.
- [ ] **M4 — Core indicators (MA / RSI / MACD / Bollinger / Volume /
  ATR / etc.) with settings + templates.**
  The indicators package is complete (45-entry registry, pure functions,
  incremental updates, worker, unit tests) but the UI catalog has drifted
  from the registry (see QA-03), instances are never computed or rendered,
  and oscillator panes are placeholders. Partial.
- [ ] **M5 — Drawing tools + persistence + undo/redo + mobile gestures.**
  The drawings package is complete (34 tools, geometry, hit testing,
  magnet snap, undo/redo history, versioned serialization, tests) but the
  UI keeps its own shallow placeholder objects, never imports the package,
  never renders drawings on the chart, and undo/redo are toast stubs.
  Drawings persist to localStorage as placeholders only. Partial.
- [ ] **M6 — Structure / analysis indicators (support & resistance,
  break & retest, zones, market structure, patterns, divergence,
  Fibonacci auto-levels) + coverage checklist.**
  Structure detectors are implemented in the indicators package, but none
  is wired to the UI or the chart, and the coverage checklist still marks
  all 58 items "planned". Partial (code) / not done (integration).
- [ ] **M7 — Alerts, watchlist, multi-chart layouts, export, PWA, i18n.**
  Shells exist for all of these (alerts dialog, watchlist, layouts, PNG
  export, PWA manifest, English + Indonesian), but alerts can never fire
  (no price feed), the watchlist always shows "—", PNG export falls back
  to a labelled snapshot when no chart handle is registered, and the PWA
  update prompt can never appear. Partial.
- [ ] **M8 — Hardening: perf budgets, a11y, security headers / CSP,
  error boundaries, docs, v1.0.0 release.**
  Not done. Perf budgets are noted in config and enforced by a CI job
  whose threshold is likely too strict (see QA-10). No Content-Security-
  Policy or security-headers file exists anywhere in the repo. No error
  boundary exists in the app shell. A11y is partial (good labels and
  focus-on-open for dialogs; no focus trap, no focus return).

## What QA verified as correct

- `ChartHost` passes exactly the props `ChartView` accepts
  (`apps/web/src/components/ChartHost.tsx:59`, `apps/web/src/chart/types.ts`):
  candles, symbol, timeframe, chartType, priceScale, theme, precision,
  magnet. `resolveTheme` returns `'light' | 'dark'`, matching
  `ChartThemeName`. Lazy loading (`ChartView` via `React.lazy`) keeps the
  charting library out of the initial chunk.
- `apps/web/src/chart/index.ts` re-exports all resolve to real exports in
  `series.ts`, `live.ts`, `layouts.ts`, `themes.ts`, `export.ts`.
- i18n is complete and consistent: `en.ts` and `id.ts` both define the
  same 128 keys, and no `translate()` call in the app references a missing
  key.
- Provider adapters: all 9 exist (`binance`, `bybit`, `okx`, `kraken`,
  `coinbase`, `gate`, `twelvedata`, `yahoo`, `stooq`), `createAdapter` /
  `adaptersForSymbol` cover every `ProviderId`, and each adapter's
  interval map matches the registry's `PROVIDER_TIMEFRAMES` for that
  provider.
- Indicator registry covers the full specified set: 17 overlays, 17
  oscillators, 11 structure detectors (45 total), each with a pure
  implementation in the package.
- Drawings package: 34 tools, `TOOL_POINTS` validation, undo/redo history
  capped at 100, versioned serialization.
- Touch targets are >= 44px and safe-area insets are used
  (`apps/web/src/index.css`); bottom nav appears only <= 900px.
- Banned-content grep over the repo is clean (no reference-source
  mentions, no tokens). `docs/internal/` is not gitignored and is never
  imported by the app bundle.

## QA findings

Severity: **blocker** = must fix before the milestone can be claimed;
**high** = user-visible break or wrong data; **medium** = feature
advertised but not working, or drift that will break the next integration;
**low** = polish / dead code.

| ID | Sev. | Finding (file:line — expected vs actual) |
|----|------|-------------------------------------------|
| QA-01 | blocker | Smoke test targets a testid that does not exist. `e2e/tests/smoke.spec.ts:6` expects `chart-container`; the app renders `data-testid="chart"` (`apps/web/src/components/ChartHost.tsx:46`) and `data-testid="chart-view"` (`apps/web/src/chart/ChartView.tsx:406`). The test fails on first run. Fixed in this QA pass (test now asserts `chart` + `chart-view` + "No data"). |
| QA-02 | blocker | No live data path exists. Nothing in `apps/web/src` imports `@trade/providers`, `@trade/indicators`, or `@trade/drawings` (only `@trade/core` is imported). `apps/web/src/components/ChartHost.tsx:23,59` passes a module-constant empty candle array and no `overlays`/`drawings` props, so the chart always shows "No data". No `fetch`/`WebSocket`/`createAdapter` call exists in the web app. `setLastPrice` / `setConnection` are never called outside `apps/web/src/store/state.tsx`, so connection stays "connecting", the watchlist always shows "—", and alerts can never fire. M2/M4/M5/M6 integration is 0%. |
| QA-03 | high | Indicator catalog drift. `apps/web/src/lib/indicators.ts` lists 34 kinds; `packages/indicators/src/registry.ts` lists 45 ids. 14 registry ids are missing from the UI catalog: `vwma`, `dema`, `tema`, `envelope`, `roc`, `momentum`, `accumulation-distribution`, `std-dev`, `order-blocks`, `fair-value-gap`, `trendlines`, `candlestick-patterns` (+ `ma-ribbon` present, `pivot-points` present — the 14 are the set difference). 3 catalog kinds do not exist in the registry: `awesome` (`lib/indicators.ts:45`, registry id is `awesome-oscillator`), `cmf` (`:46`, registry id is `chaikin-money-flow`), `patterns` (`:53`, registry id is `candlestick-patterns`). Adding one of those three creates an indicator instance whose kind has no definition; `BottomPanes` also offers `awesome`/`cmf` as pane kinds. `channels` in the catalog merges the registry's separate `trendlines` + `channels` entries. |
| QA-04 | high | Indicator default period is ignored. `apps/web/src/store/state.tsx:466` sets `period: 14` for every new indicator, ignoring the catalog defaults (e.g. SMA 50, EMA 20) and the registry defaults (SMA 50, EMA 21). The settings dialog therefore shows 14 for an SMA. |
| QA-05 | high | Drawing tool id mismatch. `apps/web/src/lib/drawings.ts:39` defines tool id `text`; the drawings package defines `text-label` (`packages/drawings/src/types.ts`, `DRAWING_TYPES`). Any future validation of a UI drawing against the package rejects the text tool. |
| QA-06 | high | Drawings are placeholders, never rendered. The UI `DrawingObject` (`apps/web/src/store/state.tsx`) is `{id, tool, label, visible, locked}` — no symbol, no anchor points, no style — while the package `DrawingObject` requires `symbol`, `type`, `points`, `style`, `zIndex`, timestamps. `DrawingToolbar` creates a placeholder on every tool click (no canvas placement, no anchors). `ChartHost` never passes drawings to `ChartView`, so nothing draws. Undo/redo buttons only toast "Nothing to undo yet." (`apps/web/src/components/DrawingToolbar.tsx:52,63`) while the package already implements `undoHistory`/`redoHistory` (`packages/drawings/src/store.ts:302,314`). The object tree's lock/duplicate/visibility/clear-all operate on placeholders only. |
| QA-07 | high | Shortcuts cheat sheet promises unimplemented keys. `apps/web/src/components/ShortcutsDialog.tsx` lists Ctrl/⌘+Z undo, Ctrl/⌘+Y redo, and single-letter tool shortcuts (T/H/V/R/B/F/L/S/X/M). `apps/web/src/App.tsx:84-100` handles only `?`, `F`, `S`, and `Escape`. No Ctrl+Z/Y handler and no tool-letter handler exist anywhere. |
| QA-08 | high | Provider timeframe drift (UI enables timeframes the adapter rejects). `apps/web/src/lib/providers.ts` gives `gate` all 13 timeframes (`:83`) and `twelvedata` all 13 (`:91`), but the registry and the adapters serve only 8 and 10 respectively (`packages/providers/src/registry.ts`, `packages/providers/src/adapters/gate.ts:21-24`, `twelvedata.ts:22-25`): Gate.io lacks 3m/6h/12h/1W/1M, Twelve Data lacks 3m/6h/12h. `stooq` is listed in the UI as `['1D','1W','1M']` (`lib/providers.ts:107`) but the registry and adapter serve only `['1D']`. Selecting one of those timeframes would call `intervalFor`, which throws `UnsupportedError`. Kraken, Coinbase, Yahoo, Binance, Bybit, OKX match. |
| QA-09 | medium | Symbol registry drift. The providers registry lists 4 symbols including `PAXG/USDT`, a Yahoo `BTC-USD` proxy, and an unverified Bybit `XAUUSDT` perpetual proxy (`packages/providers/src/registry.ts`); the UI's source of truth, core `SYMBOLS` (`packages/core/src/index.ts`), lists only 3 symbols with no PAXG entry and no Yahoo/Bybit entries for those pairs. PAXG is unreachable from the UI. The watchlist also shows the current provider's label on every row, even for symbols that provider does not serve (`apps/web/src/components/Watchlist.tsx`). |
| QA-10 | medium | Bundle budget measures the wrong thing and is likely to fail. `.github/workflows/ci.yml:209-224` sums the gzip size of **all** JS in `dist/assets` and fails above 250 KB, but the spec is *initial* JS ≤ 250 KB gz. React + React DOM + the charting library alone are expected to exceed 250 KB gz in total, so the first build job is likely red. The Lighthouse script budget (250 KB, `.github/lighthouse-budget.json`) has the same total-vs-initial problem. `apps/web/vite.config.ts:43` only sets `chunkSizeWarningLimit: 250` (uncompressed KB, per chunk, warning only) — it does not enforce the gz budget. |
| QA-11 | medium | PWA update prompt can never appear. `apps/web/src/components/PwaUpdatePrompt.tsx:21` listens for a custom `trade:pwa-update` window event that no file in the repo dispatches. No `virtual:pwa-register` import exists anywhere in `apps/web/src`. Service-worker registration therefore rests entirely on the plugin's implicit default, which is not verified in-repo. |
| QA-12 | medium | PNG export falls back to a fabricated snapshot. `apps/web/src/App.tsx` calls `downloadChartSnapshot` (`apps/web/src/lib/exportChart.ts`) when no chart handle is registered; that draws a labelled placeholder PNG whose own text says a full chart export "arrives with the chart engine" — but the chart engine has already landed. Stale copy in `lib/exportChart.ts` and in the unused i18n keys `screenshotPending`, `chartEnginePending`, `chartPlaceholderTitle`, `chartPlaceholderBody`. |
| QA-13 | medium | `index.html` uses root-absolute asset URLs (`/favicon.svg`, `/manifest.webmanifest`, `apps/web/index.html:14-15`) while Vite is configured with `base: './'`. On a GitHub Pages project site (e.g. `…github.io/Trade/`) those assets 404. There are also two manifests: `apps/web/public/manifest.webmanifest` (linked) and the one generated by `vite-plugin-pwa` from `vite.config.ts`. |
| QA-14 | medium | E2E-only changes never run e2e. `.github/workflows/ci.yml:236` — the `e2e` job `needs: [changes, build]`, but `build` is skipped when only `e2e/**` changed (its `if` requires `web == 'true'`), and a needed skipped job skips its dependents. Also the `setup` job uploads a `workspace` artifact that no downstream job downloads (each job re-checks-out and reinstalls). |
| QA-15 | medium | Coverage gate is advisory only. `.github/workflows/ci.yml:176-180` runs the ≥ 85% gate with `|| true` ("advisory in M1"). The spec requires a ≥ 85% gate on indicators & providers. |
| QA-16 | medium | `migrateState` does not cross-validate provider vs symbol. Importing a state document with `symbol: XAU/USD` + `provider: binance` passes migration (`apps/web/src/store/state.tsx`), leaving the provider `<select>` with a value that is not among its options (blank select) until the user changes symbol. `setSymbol` does fix this on symbol change, but import does not. |
| QA-17 | low | Unused dependency. `zustand` is in `apps/web/package.json:22` and in the `vendor` manual chunk (`apps/web/vite.config.ts:50`), but no file imports it — state is React context. It still ships in the bundle. |
| QA-18 | low | Stale comments/docs. `apps/web/vite.config.ts:43-45` claims indicators and drawings "are code-split into lazy chunks (see src/App.tsx)" — `App.tsx` lazy-loads nothing; only `ChartView` is lazy (in `ChartHost`). `apps/web/src/lib/exportChart.ts` header says "Until the chart engine lands". Unused i18n keys: `chartEnginePending`, `chartPlaceholderTitle`, `chartPlaceholderBody`, `screenshotPending`, `drawings`, `provider`, `price`, `change`, `lastUpdate`, `watchlistConnecting`, `addIndicator`, `cancel`, `clearDrawingsTitle`, `appName`. |
| QA-19 | low | Modal has no focus trap and no focus return. `apps/web/src/components/Modal.tsx` focuses the close button on open (good) but does not trap Tab inside the dialog or return focus to the trigger on close. Escape is handled twice (App + Modal) — harmless, both close. |
| QA-20 | low | `MultiChartLayout` mirrors one symbol/timeframe across all panels (`apps/web/src/components/MultiChartLayout.tsx`); per-panel symbol selection is a documented follow-up, not a bug, but the layout picker advertises 2 / 2×2 as if the panels were independent. |

## Performance-budget wiring

- `apps/web/vite.config.ts`: `chunkSizeWarningLimit: 250` + `manualChunks`
  (`vendor`: react/react-dom/zustand, `charts`: charting library) + a
  comment stating the 250 KB gz budget. This is a **note + warning only**;
  it does not fail a build.
- `.github/workflows/ci.yml` "Bundle-size budget" job: enforced (fails the
  job above 250 KB gz) but measures **total** JS, not initial JS — see
  QA-10. Expected to fail on the first run.
- `.github/lighthouse-budget.json`: script 250 KB, total 600 KB, LCP
  2.5 s, interactive 5 s, CLS 0.1 — enforced by the Lighthouse CI job
  (needs a green build first). No measured values exist yet; nothing has
  run.
- No runtime perf measurement exists in the app (no fps / long-task
  instrumentation). The "60 fps with 10k candles + 5 indicators" budget
  is untestable until live data is wired in (QA-02).

## E2E coverage added by QA

`e2e/tests/app.spec.ts` (new): symbol switch (dialog + watchlist), symbol
search, timeframe switch, provider switch + unsupported-timeframe disable,
provider list per symbol, chart type / price scale, add indicator + remove,
indicator persistence across reload, draw + persist across reload, theme
persistence, 2×2 layout, add price alert, state export/import round-trip,
screenshot button, mobile 390×844, desktop 1920×1080, tablet 768×1024
(no horizontal scroll). `e2e/tests/visual.spec.ts` (new): first-run-safe
screenshot captures (desktop, light theme, mobile, indicator+drawing,
dialog) — buffer-length assertions only, with instructions to promote to
pixel baselines after the first green run. `e2e/tests/a11y.spec.ts`
(new): html lang + theme, every button has an accessible name, every
select/input labelled, Tab focus order, `?` opens / Escape closes the
shortcuts dialog, F/S keys, dialog modal attributes, chart region labels
and live legend, toast aria-live.
`e2e/tests/smoke.spec.ts` (fixed): corrected testid `chart-container` →
`chart` + `chart-view` (QA-01).
No change to `e2e/playwright.config.ts` was needed: base URL, projects
(chromium, mobile-chromium 390×844, mobile-webkit), trace/video/screenshot
on failure only, and the preview web server are all correct for these
tests.

## Push readiness

**Ready for a first push: YES, with the expectation that CI goes red.**
Blockers and expected first-run failures:

1. **Repository does not exist yet.** `glimmora/Trade` must be created
   manually by the user (the connector could not create
   `SecretArrow/Trade`: the connected account has no org-create permission
   there). Until it exists there is nothing to push to. No token is
   needed if the push goes through the GitHub connector's `push_files`.
2. **`pnpm-lock.yaml` is missing.** The bootstrap workflow
   (`.github/workflows/bootstrap-lockfile.yml`) must run first (or the
   first CI install runs unfrozen, with a warning). `actions/setup-node`
   with `cache: pnpm` runs before the install step and may warn/fail
   while the lockfile is absent — unverified until CI runs.
3. **Expected red on first CI run:** QA-01 is fixed in the tests, but
   QA-10 (bundle budget, total vs initial JS) is likely to fail the
   build job; QA-14 (e2e skipped when only e2e files change) and any
   still-unseen TypeScript/ESLint errors in the agent-written code can
   only be found by running CI. The coverage gate is advisory, so unit
   tests will not block the pipeline.
4. No secrets and no reference-source mentions were found in the tree
   (verified by grep, excluding the intentional token-detection regex
   inside `.gitleaks.toml` itself), so pushing is safe from that angle.

## Fixer checklist (after the first CI run)

1. Wire the data layer (QA-02 — biggest item): create the adapter from
   the provider dropdown, fetch candles on symbol/timeframe/provider
   change, feed them to `ChartHost`/`ChartView`, drive `setLastPrice` /
   `setConnection` / `checkAlerts` from live ticks, and compute
   indicator overlays from `@trade/indicators` into `ChartView`
   `overlays`. Until this lands, M2–M7 cannot be claimed.
2. Reconcile the indicator catalog with the registry (QA-03) and use the
   registry/catalog defaults in `addIndicator` (QA-04); render overlays
   and oscillator panes from real computed values.
3. Reconcile the drawings model (QA-05, QA-06): use the package
   `DrawingObject` (symbol, points, style) in the store, render drawings
   through `ChartView` `drawings`, wire undo/redo to the package history,
   and place drawings by chart click instead of creating placeholders.
4. Fix the provider timeframe tables (QA-08) and the symbol lists
   (QA-09, incl. PAXG reachability) from the single source of truth
   (providers registry), and cross-validate provider vs symbol on import
   (QA-16).
5. Fix the bundle budget to measure initial JS (QA-10) or raise it with
   justification; fix the Pages asset paths (QA-13); fix the e2e
   `needs` so e2e-only changes run e2e (QA-14); make the coverage gate
   fail the job (QA-15); remove the unused `zustand` dep or use it
   (QA-17).
6. Implement the advertised shortcuts (QA-07) or remove them from the
   cheat sheet; make the PWA update prompt real or remove it (QA-11);
   make PNG export capture the real chart or label the fallback honestly
   (QA-12).
7. Re-run this QA pass after the wiring lands: re-check every QA ID,
   promote the visual screenshots to pixel baselines, and only then mark
   M1–M3 done.
