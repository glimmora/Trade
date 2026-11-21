# Trade — Charting Terminal

Trade is a responsive, single-page charting terminal for technical
analysis: candlestick charts, indicators, drawing tools, and
trading-analysis overlays, with live data from free public market-data
providers.

For informational purposes only. Not financial advice.

## Pairs

- BTC/USDT
- XAU/USD (spot gold)
- XAUT/USDT (tokenized gold)

Adding a symbol is a config-only change: add it to the symbol
registry and its supported providers in `packages/providers`.

## Features (M1 scaffold)

- Monorepo: `apps/web` (Vite + React + TypeScript strict + Tailwind),
  `packages/core`, `packages/indicators`, `packages/drawings`,
  `packages/providers`, `workers/proxy`, `e2e` (Playwright).
- Timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1D, 1W, 1M
  (per provider capability; unsupported ones are disabled).
- Chart types: Candlestick, Hollow candles, Bar (OHLC), Line, Area,
  Heikin-Ashi, Baseline.
- Data sources (free public APIs; keys, where required, are entered by
  the user in Settings and stored only in localStorage, never committed):
  Binance, Bybit, OKX, Kraken, Coinbase Exchange, Gate.io, Twelve Data,
  Yahoo Finance, Stooq.
- Dark / light / system themes, responsive desktop and mobile layouts,
  PWA with offline shell.
- State persisted in localStorage with a versioned schema.

## Development

Everything is built, linted, and tested in GitHub Actions. Locally,
only edit files, commit, and push; read Actions logs to iterate.

```sh
corepack enable
pnpm install
pnpm dev        # local dev server (apps/web)
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Requires Node.js >= 20 and pnpm >= 9.

## Deployment

`main` deploys automatically to GitHub Pages after green CI
(see `.github/workflows/release.yml`).

## License

Apache License 2.0 — see `LICENSE` and `NOTICE`. The charting engine
is Lightweight Charts (Apache-2.0); its required attribution is kept
in `NOTICE` and in the built bundle.

## Disclaimer

For informational purposes only. Not financial advice.
