# Internal Study Notes — Break & Retest / Support-Resistance Method (Gold)

> Internal developer notes only. Not shipped in the app bundle, not user-facing.
> All concepts below are paraphrased in neutral, industry-standard terms.
> Source material studied: two reference documents on gold (XAUUSD) technical
> analysis — one focused on a break-and-retest method combining support/resistance,
> parallel channels and supply/demand; the other a structured 14-day-style
> beginner-to-intermediate guide to gold trading (11 topic zones). Page counts:
> 11 pages and 20 pages respectively. Most chart content in both sources is
> illustrative screenshots; the extractable text is short and is summarised here
> in the author's own words, not quoted.

## 1. Overview

The core method is a top-down, multi-timeframe, zone-based discretionary system
for gold (XAUUSD):

1. Map the big picture first: support/resistance on H4 (and Daily/Weekly for
   overall direction).
2. Draw parallel channels on H4 (price bounds) and M30 (entry hunting).
3. Refine down through M5 and M1 to find supply/demand zones near the channel
   midline.
4. Enter only on a confirmed retest of a zone, with a limit order placed inside
   the zone, a structural stop, and a minimum risk:reward of 1:2 (1:3 in the
   core method).
5. Manage the trade (move stop to breakeven once running, trail, exit at the
   next zone) and size risk at 1–2% per trade.

The companion guide covers the same foundations from first principles —
market structure, support/resistance, role-flips, breakouts vs false breakouts,
entry/exit plans, dynamic support/resistance, money management and trading
psychology — and is the source of most of the general rules below.

Scope note: the core method was reportedly backtested for two years on gold
only. The guidance is explicit that applying it to any other pair requires a
fresh backtest first. The app must therefore treat gold as the reference
instrument for these detectors and must not imply the same edge transfers to
other symbols.

## 2. Support & Resistance method

- **Primary timeframe:** H4. Support/resistance is mapped on H4 *before* any
  position is considered. It is used to understand where price is likely to go
  (directional context / reversal areas), not as a standalone entry trigger.
- **How a level is found:** look for a sharp turning ("menukik") area on H4 —
  a pronounced swing where price reversed.
- **Validity rule (breakout-confirmed):** a support/resistance level only
  counts as valid once price has broken out of / away from it after forming.
  A level that has never produced a breakout is not yet confirmed.
- **Invalidation rule (body vs wick):** a level is invalid once a candle
  *body* closes through it. If only a wick touches or pierces it, the level
  remains valid.
- **Strength:** the more often an area is tested and holds, the stronger it is
  considered — but with a caveat: an area tested *too* many times may be
  weakening (liquidity being consumed). The app should surface touch count and
  let the user judge; it should not present touch count as a guarantee.
- **Zones, not lines:** think in areas, not thin points. A level is a reaction
  *area*. Drawing too many lines creates confusion; the detector should cluster
  nearby pivots into a single zone.
- **Key-zone workflow:** identify the main reaction zones on the large
  timeframe (H4/Daily), then drop to a smaller timeframe (H1/M30) to plan the
  entry.

Detector parameters implied: swing-pivot lookback for turning points,
clustering tolerance for merging nearby pivots into one zone, minimum touches
for "tested" status, body-close invalidation check.

## 3. Break & Retest rules

### 3.1 Role flips (SBR / RBS)

- **Support-becomes-resistance (SBR):** a broken support level becomes a new
  resistance level.
- **Resistance-becomes-support (RBS):** a broken resistance level becomes a
  new support level.
- A role flip is the core "change in role = change in opportunity" event and
  is what the retest entry trades.

### 3.2 Breakout vs false breakout

- **Breakout:** a candle *closes* outside the support/resistance zone. Close,
  not wick, is the validation criterion.
- **False breakout:** price penetrates the zone temporarily, then returns
  inside it. No close outside = no confirmed breakout.
- **Rule:** never enter on the first breakout impulse (no FOMO chasing).
  Wait for a confirmation candle *and* a retest before entering.

### 3.3 The retest entry (core method)

Sequence, in order:

1. **Breakout candle** — a candle closes through the level/zone (or through
   prior M30 support in the worked example), establishing the directional bias.
2. **Retest zone** — price returns to the broken zone. In the core method the
   retest zone is the supply/demand zone found at the channel midline (see
   section 5); in the general guide it is the broken S/R zone itself.
3. **Confirmation candle** — a reversal candle at the zone (pin bar / hammer
   or engulfing pattern) confirms rejection before entry. Entry without
   confirmation is listed as a common mistake.
4. **Entry placement** — a limit order inside the zone: at **50% of the zone
   candle** or at its close, so that adverse excursion ("floating") while the
   order fills is small. Never a market chase.
5. **Stop loss** — placed beyond the zone (beyond the zone candle extreme /
   beyond the broken structure), i.e. a structural stop, not an arbitrary
   pip distance.
6. **Targets** — minimum risk:reward **1:2** (general guide) and **1:3**
   (core method). The extended target in the core method is the wick extreme
   of the M30 candle where the first channel swing sequence formed.
7. **Trade management** — once the trade is running in profit, move the stop
   to breakeven (stop-plus). The general guide adds: exit at the next
   support/resistance zone, and use a trailing stop to lock profit.

### 3.4 Entry modes (general guide)

Three distinct entry types the app should support as modes of one detector:

| Mode | Trigger |
| --- | --- |
| Rejection entry | Price bounces off an S/R zone (confirmation candle at the zone) |
| Breakout entry | Candle closes outside the zone, enter on the break |
| Retest entry | Price returns to test the broken zone, enter on confirmation |

### 3.5 Detector parameters (configurable)

- Tolerance % for what counts as "touching / retesting" a zone (zone width
  and proximity threshold).
- Lookback (bars) for swing detection and zone formation.
- Minimum retest wait: the retest must occur after the breakout (no
  simultaneous break-and-retest on the same candle).
- Maximum retest window: a retest arriving too late after the breakout is
  stale and should not trigger.
- Minimum R:R filter (1:2 / 1:3 presets).
- Confirmation-candle requirement toggle (pin bar / engulfing).

## 4. Parallel channels & trendlines

- **Construction rule:** a parallel channel may only be drawn once a
  three-point zigzag has formed: LH–LL–LH (in a down move) or LL–LH–LL (in an
  up move). Fewer than three swing points = wait; do not draw early.
- **Timeframe roles:** H4 channel defines the upper and lower bounds of price;
  M30 channel is used to hunt entries. The M30 channel uses the same
  three-point rule, then adds a **fourth point** (the next LH/LL) as the entry
  point.
- **Midline:** the channel's middle line is significant — supply/demand zones
  are looked for at/near the midline (see section 5).
- **Refinement ladder:** draw on H4, refine on M30, refine again on M5, then
  M1. Each step down narrows the zone.
- **Trendline (general guide):** trendlines and channels count as *dynamic*
  support/resistance. Static zones + dynamic lines together make a stronger
  setup than either alone.

Detector parameters implied: swing-pivot strength (left/right bars), minimum
three touches, parallelism tolerance between the two channel rails, midline
offset display.

## 5. Supply & Demand zones (SND)

- **Where they appear:** at the channel midline on M5 (after the H4 → M30 →
  M5 refinement). Strong zones are stated to appear on M5.
- **Buy zone pattern:** a three-candle sequence — bullish, bearish, bullish
  (green-red-green). The middle (opposite-colour) candle is the zone candle.
- **Sell zone pattern:** bearish, bullish, bearish (red-green-red).
- **Multi-timeframe confirmation:** after finding a zone on M5, drop to M1 and
  mark the zone again there. A valid M1 zone must already have been *retested*
  on M1 first — an untested M1 zone is not yet valid.
- **Nesting:** an M1 zone may sit above (or inside) the M5 zone; both are
  marked and the finer one refines the entry.
- **Entry inside the zone:** limit order at 50% of the zone candle or at its
  close (see 3.3).
- **Extra confluence (worked example):** a sell is strengthened when a prior
  M30 support has already broken — i.e. the zone aligns with a broken
  structure level in the same direction.

Detector parameters implied: the 3-candle pattern definition (colour sequence
plus relative size / range filters), zone width = zone-candle high/low,
retest-required flag per timeframe, nesting display (M5 + M1 zones together).

## 6. Market structure (HH / HL / LH / LL, BOS, CHoCH)

- **Vocabulary:** uptrend = series of higher highs (HH) and higher lows (HL),
  buyers dominant; downtrend = lower highs (LH) and lower lows (LL), sellers
  dominant; sideways = flat, ranging price, market "resting".
- **Cardinal rule:** do not trade against the structure. In an uptrend do not
  hunt sells merely because price "looks high"; follow the flow.
- **Structure labels in the core method:** the LH/LL swing sequence is the
  input to channel drawing (section 4) — structure labelling and channel
  detection share the same swing-pivot engine.
- **BOS / CHoCH:** the sources do not use the terms "break of structure" or
  "change of character" by name. The equivalent events they *do* describe are:
  a swing high/low being broken by a candle close (the breakout that validates
  an S/R level, section 2) and a role flip (SBR/RBS, section 3.1). The app's
  BOS/CHoCH labels should be implemented as those two named events, and must
  not be presented as source terminology.
- **Multi-timeframe structure:** Daily/Weekly = main trend; H4 = main S/R
  areas; H1 = entry timing (general guide). Top-down order: Daily → H4 →
  M15/H1.

## 7. Fibonacci levels

- **Finding: Fibonacci is not used in either source.** No retracement,
  extension, fan, arc or time-zone concept appears in the text or in any chart
  screenshot. Fibonacci support in the app is therefore an app-specification
  addition, not a source-derived feature, and must be labelled as a standard
  tool, not as part of this method. Standard levels (23.6 / 38.2 / 50 / 61.8 /
  78.6, extensions 127.2 / 161.8) are the usual implementation.

## 8. Candlestick patterns

Patterns named or illustrated in the sources:

- **Engulfing** — named as a confirmation candle and illustrated as a chart
  pattern (bearish engulfing at resistance in the example).
- **Pin bar / hammer** — named as a confirmation candle at a zone
  ("pinbar, engulfing").
- **Double top** — illustrated as a confirmation chart pattern.
- **Head & shoulders** — illustrated as a confirmation chart pattern.

Not named in the sources: doji, morning/evening star, inside bar, three
soldiers/crows, harami. The app's pattern recogniser should implement at
minimum the four above (source-derived) and may add the standard remainder as
app-spec additions, clearly separable in the pattern settings.

Usage rule from the sources: patterns are *confirmation* at a zone, never a
standalone entry signal. A pattern away from a zone carries no weight in this
method.

## 9. Divergence

- **Finding: divergence is not described in either source.** No RSI/MACD
  divergence (regular or hidden) appears in the text or charts. The app's
  divergence detector is an app-specification addition. If implemented, the
  natural pairing per the master spec is RSI and MACD, regular + hidden, with
  pivot-based swing comparison — but that design is not source-derived.

## 10. Other indicators named in the sources

- **Moving averages (dynamic S/R):** MA 50 and MA 200 are the only periods
  named. They are presented as dynamic support/resistance, to be combined
  with static zones.
- **Trendline / channel:** dynamic S/R (see section 4).
- **No oscillators are named or shown** in either source: no RSI, MACD,
  Stochastic, ATR, VWAP, Bollinger Bands or volume indicator appears. The
  app's full indicator library is therefore app-specification scope, not
  source-derived. The method itself is pure price action (structure + zones +
  channels + candle patterns).

## 11. Fair-value gaps / order blocks

- **Finding: neither concept is named in either source.** The closest
  source-described concept is the supply/demand zone (section 5): a
  three-candle sequence whose middle candle defines a tradable zone, and the
  role-flip zone (SBR/RBS, section 3.1). If the app implements fair-value-gap
  and order-block detectors, they should be built as extensions of the
  supply/demand zone engine and labelled with neutral standard names — they
  are not source terminology and must not be attributed to the method.

## 12. Risk & money management

Rules stated in the sources (both documents agree):

- **Risk per trade: maximum 1–2% of capital.** Position (lot) size is derived
  from account size, risk % and stop distance — never the reverse.
- **Stop loss must be logical** (structural: beyond the zone / beyond the
  broken level), not arbitrary.
- **Minimum R:R 1:2** (general guide); **1:3 minimum** in the core method,
  with extension to the channel-swing wick extreme.
- **Trailing stop** to lock profit once running; move stop to breakeven
  ("stop-plus") once the trade is running in profit.
- **Focus on risk, not profit target.** Survival first, profit second.
- **No overlot / no revenge trading.** After a loss, do not increase size to
  "win it back"; stop, rest, evaluate objectively, resume the next day.
- **Realistic expectations:** consistent 3–5% per month is presented as a
  realistic professional target; 50% per month is not.
- **Probability mindset:** a 60% win-rate system still loses 4 trades in 10;
  with a good R:R it remains profitable. Judge a system over a sample, not
  over one or two trades.
- **Closing principle (core method):** no trader succeeds without proper money
  management and without controlling emotion.

App implications: the long/short position tool must include a size calculator
(risk % → position size from entry/stop distance), R:R display, breakeven and
trailing-stop markers, and the trade plan panel should record entry/SL/TP
before the trade ("plan your trade, trade your plan").

## 13. Session & timeframe notes

- **Top-down ladder:** Daily/Weekly (main trend) → H4 (main S/R areas, channel
  bounds) → H1/M30 (momentum / entry timing) → M15/M5 (scalping execution
  detail) → M1 (zone refinement).
- **Trader-type mapping (general guide):** Daily–Weekly = swing trader;
  H4–H1 = intraday trader; M15–M5 = scalper.
- **Core-method ladder:** H4 channel → M30 channel + entry point → M5
  supply/demand → M1 supply/demand (retest-validated).
- **No session times are specified** (no London/New York session rules, no
  news-calendar rules) in either source. Any session overlay is app-spec.
- **Fundamental context (general guide only):** gold is a safe haven; it tends
  to rise on economic instability / conflict and fall when the dollar
  strengthens or the economy stabilises. This is background context for the
  trader, not a tradable signal in the method, and the app should not present
  it as one.

## 14. Psychology & process rules (for the journal / checklist features)

The guide's psychology section is extensive and maps directly onto app
features (trading journal, pre-trade checklist, daily discipline prompts):

1. Focus on process, not results — journal entry setup, SL/TP per plan,
   overtrading flag.
2. Accept losses as part of the game — even professionals lose 40–50% of the
   time; keep losses small and measured.
3. No revenge trading — after a big loss, close the chart, rest, evaluate.
4. Lot size matched to risk (1–2%) — overlot equals high emotion.
5. Discipline to the trading plan — "no plan, no trade": entry, SL, TP and
   the if-wrong plan defined before entry.
6. Realistic expectations — consistency over speed; gold trading is survival,
   not a get-rich-quick vehicle.
7. Mental/physical condition — do not trade when emotional, tired or angry.
8. Journal emotions, not just entries — record why an entry was early/late.
9. Patience waiting for a setup — "no setup, no trade" is the mandatory
   mantra; most losses come from impatience, not bad analysis.
10. Probability mindset — see section 12.

Common mistakes listed (useful as in-app warnings / checklist items):
overtrading without knowing trend direction; too many S/R lines; entering too
fast without seeing the big zone; entering before the retest (false-breakout
trap); FOMO entry on the first breakout; entering without confirmation;
exiting too early out of fear; relying on lines alone and forgetting price
action; taking big risk out of overconfidence.

## 15. Coverage gaps — concepts in the app spec with no source support

The following are required by the app specification but appear **nowhere** in
the studied material. They must be implemented as standard, neutral
technical-analysis features and must never be presented as part of the studied
method:

- Fibonacci retracement / extension / fan / arcs / time zones
- Fair-value gaps / imbalance zones
- Order-block zones (source analogue: supply/demand zones, section 5)
- Divergence detection (RSI/MACD, regular + hidden)
- BOS / CHoCH labels under those names (source equivalents: breakout
  validation and SBR/RBS role flips)
- All oscillators and volatility/volume indicators (RSI, MACD, Stochastic,
  ATR, Bollinger Bands, VWAP, OBV, etc.) — the sources use pure price action
- Session overlays / news-calendar rules
- Any indicator period other than MA 50 / MA 200

## 16. Implementation priorities derived from the sources

1. Swing-pivot engine first — everything (S/R zones, structure labels,
   channels, SND zones) is built on reliable swing detection.
2. Zone engine second — clustering, body-close invalidation, wick tolerance,
   role-flip detection, touch counting.
3. Break & retest detector third — breakout candle + retest zone +
   confirmation candle + entry/stop/target lines, with the configurable
   parameters in 3.5.
4. Channel detector fourth — three-point zigzag rule, midline, MTF roles.
5. SND detector fifth — three-candle pattern, M5/M1 nesting, retest-required.
6. Pattern recogniser sixth — engulfing, pin bar/hammer, double top,
   head & shoulders (confirmation-only usage).
7. Position tool + risk calculator seventh — R:R, size from 1–2% risk,
   breakeven/trailing markers.
8. Journal / checklist eighth — the psychology and process rules of section 14.
