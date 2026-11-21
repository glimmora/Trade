# Trade — Status

## Milestones

- [x] **M1 — Scaffold + CI/CD green + deploy "hello chart" to Pages.**
  Monorepo scaffold, workflows (CI, autofix, release, provider smoke,
  deps), GitHub Pages deploy, minimal app shell.
- [ ] **M2 — Providers + real candles for all 3 pairs + provider
  dropdown + accuracy cross-check.**
- [ ] **M3 — Chart types, timeframes, live updates, dark/light theme,
  responsive shell.**
- [ ] **M4 — Core indicators (MA / RSI / MACD / Bollinger / Volume /
  ATR / etc.) with settings + templates.**
- [ ] **M5 — Drawing tools + persistence + undo/redo + mobile gestures.**
- [ ] **M6 — Structure / analysis indicators (support & resistance,
  break & retest, zones, market structure, patterns, divergence,
  Fibonacci auto-levels) + coverage checklist.**
- [ ] **M7 — Alerts, watchlist, multi-chart layouts, export, PWA, i18n.**
- [ ] **M8 — Hardening: perf budgets, a11y, security headers / CSP,
  error boundaries, docs, v1.0.0 release.**

## Current status (M1)

- Scaffold in place; CI must go green on `main` before M1 is done.
- No indicator, provider, or chart-engine logic yet — those land in
  later milestones from their owning agents.
