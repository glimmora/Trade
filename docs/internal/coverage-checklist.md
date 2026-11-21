# Feature Coverage Checklist — Strategy Concepts → App Features

> Internal developer checklist. Maps every concept in the internal study notes
> to a planned app feature. Status column is updated by the implementing agent.
> "Source" = described in the studied reference material. "App spec" = required
> by the app specification but not present in the studied material; implement as
> a standard neutral technical-analysis feature, never presented as part of the
> studied method.

## A. Support & Resistance

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| A1 | Swing-pivot S/R auto-detection (H4 default) | S/R detector (swing pivots + clustering) | Source | planned |
| A2 | S/R validity: body close through level invalidates; wick touch keeps it valid | S/R detector — body-close invalidation rule | Source | planned |
| A3 | S/R strength by touch count (more tests = stronger, with over-test weakening caveat) | S/R detector — touch count + strength score | Source | planned |
| A4 | Zones, not thin lines (reaction areas; cluster nearby pivots) | Zone rendering (rectangles with width) | Source | planned |
| A5 | Key-zone workflow: large TF zones → small TF entry plan | Multi-timeframe zone display | Source | planned |
| A6 | Breakout-confirmed levels only (level must have produced a breakout) | S/R detector — breakout-confirmed flag | Source | planned |

## B. Break & Retest

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| B1 | Breakout candle (close outside the zone) | Break & Retest detector — breakout marker | Source | planned |
| B2 | False breakout (temporary penetration, then return inside) | Break & Retest detector — false-breakout marker | Source | planned |
| B3 | Retest zone (price returns to the broken zone) | Break & Retest detector — retest zone highlight | Source | planned |
| B4 | Confirmation candle before entry (pin bar / engulfing) | Break & Retest detector — confirmation check | Source | planned |
| B5 | Entry modes: rejection / breakout / retest | Break & Retest detector — entry-mode setting | Source | planned |
| B6 | Entry at 50% of zone candle or at its close (limit order) | Entry/stop/target suggestion lines | Source | planned |
| B7 | Structural stop beyond the zone | Entry/stop/target suggestion lines | Source | planned |
| B8 | Minimum R:R 1:2, core method 1:3; extended target at channel-swing wick extreme | Entry/stop/target suggestion lines + R:R display | Source | planned |
| B9 | Move stop to breakeven once running; trailing stop | Position tool — breakeven / trailing markers | Source | planned |
| B10 | Configurable tolerance %, lookback, min retest wait, max retest window, min R:R | Break & Retest detector — settings dialog | Source | planned |
| B11 | SBR (support becomes resistance) role flip | Market-structure detector — SBR label | Source | planned |
| B12 | RBS (resistance becomes support) role flip | Market-structure detector — RBS label | Source | planned |

## C. Parallel Channels & Trendlines

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| C1 | Parallel channel auto-detect (3-point LH/LL zigzag rule) | Channel auto-detect indicator | Source | planned |
| C2 | Channel midline (supply/demand looked for near midline) | Channel auto-detect — midline display | Source | planned |
| C3 | H4 channel = price bounds; M30 channel = entry hunting (+ 4th point as entry point) | Channel auto-detect — multi-timeframe roles | Source | planned |
| C4 | Trendline auto-detect | Trendline auto-detect indicator | Source | planned |
| C5 | Trendline / channel as dynamic S/R (static + dynamic combined) | Dynamic S/R overlay | Source | planned |

## D. Supply & Demand Zones

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| D1 | Buy zone: 3-candle green-red-green sequence | Supply/Demand detector — buy zones | Source | planned |
| D2 | Sell zone: 3-candle red-green-red sequence | Supply/Demand detector — sell zones | Source | planned |
| D3 | Strong zones on M5; M1 zone must already have been retested on M1 | Supply/Demand detector — timeframe strength + retest-required flag | Source | planned |
| D4 | Nested zones (M1 zone inside/above M5 zone) | Supply/Demand detector — nested zone display | Source | planned |
| D5 | Zone width = zone-candle high/low; entry at 50% / close | Supply/Demand detector — zone rendering | Source | planned |
| D6 | Confluence: zone aligned with already-broken structure strengthens the setup | Confluence score in Break & Retest detector | Source | planned |

## E. Market Structure

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| E1 | HH / HL / LH / LL swing labels | Market-structure labels overlay | Source | planned |
| E2 | Trend classification: uptrend (HH/HL), downtrend (LH/LL), sideways | Market-structure detector — trend state | Source | planned |
| E3 | "Do not trade against structure" guard | Market-structure detector — against-trend warning | Source | planned |
| E4 | BOS label (break of structure) | Market-structure detector — BOS label | App spec | planned |
| E5 | CHoCH label (change of character) | Market-structure detector — CHoCH label | App spec | planned |
| E6 | Top-down ladder: Daily/Weekly trend → H4 zones → H1/M15 timing | Multi-chart layout + timeframe presets | Source | planned |

## F. Candlestick Patterns (confirmation at zones only)

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| F1 | Engulfing (bullish / bearish) | Pattern recogniser — engulfing marker | Source | planned |
| F2 | Pin bar / hammer | Pattern recogniser — pin bar marker | Source | planned |
| F3 | Double top | Pattern recogniser — double-top marker | Source | planned |
| F4 | Head & shoulders | Pattern recogniser — head & shoulders marker | Source | planned |
| F5 | Doji, inside bar, morning/evening star, harami, three soldiers/crows | Pattern recogniser — extended set (toggleable) | App spec | planned |

## G. Fibonacci

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| G1 | Fibonacci retracement auto-levels (23.6 / 38.2 / 50 / 61.8 / 78.6) | Fibonacci retracement tool + auto-levels | App spec | planned |
| G2 | Fibonacci extension levels (127.2 / 161.8) | Fibonacci extension tool | App spec | planned |
| G3 | Fibonacci fan / arcs / time zones | Fibonacci drawing tools | App spec | planned |

## H. Gaps, Order Blocks, Divergence (app-spec extensions)

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| H1 | Fair-value-gap / imbalance zones | FVG detector (extension of zone engine) | App spec | planned |
| H2 | Order-block style zones | Order-block detector (extension of zone engine) | App spec | planned |
| H3 | Divergence detector — RSI regular + hidden | Divergence detector (RSI) | App spec | planned |
| H4 | Divergence detector — MACD regular + hidden | Divergence detector (MACD) | App spec | planned |

## I. Other Indicators Named in the Sources

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| I1 | MA 50 / MA 200 as dynamic S/R | Moving-average overlays (SMA/EMA, periods 50/200 presets) | Source | planned |
| I2 | Full standard indicator library (RSI, MACD, Stochastic, ATR, Bollinger, VWAP, OBV, etc.) | Indicator library (pure functions + worker) | App spec | planned |

## J. Risk, Position Tool & Journal

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| J1 | Risk per trade max 1–2% of capital | Position-size calculator (risk % input) | Source | planned |
| J2 | Long/short position tool with R:R, P&L %, size calculator | Long/short position drawing tool | Source | planned |
| J3 | Exit at next S/R zone | Position tool — target at next zone suggestion | Source | planned |
| J4 | "Plan your trade, trade your plan" pre-trade checklist | Trade-plan panel (entry/SL/TP defined before entry) | Source | planned |
| J5 | Trading journal incl. emotion log; process-over-results tracking | Journal panel | Source | planned |
| J6 | Discipline prompts: "no setup, no trade", "no plan, no trade", no revenge trading | Journal / checklist prompts | Source | planned |

## K. Sessions, Timeframes & Context

| # | Concept | Planned app feature | Origin | Status |
|---|---------|---------------------|--------|--------|
| K1 | Trader-type timeframe presets (swing Daily–Weekly, intraday H4–H1, scalper M15–M5) | Timeframe presets | Source | planned |
| K2 | Core-method ladder presets (H4 → M30 → M5 → M1) | Multi-timeframe preset | Source | planned |
| K3 | Session overlay (trading sessions) | Session indicator | App spec | planned |

## Summary counts

- Total checklist items: **58**
- Source-derived: **46**
- App-spec additions (no source support — implement as standard neutral features): **12** (E4, E5, F5, G1–G3, H1–H4, I2, K3)
