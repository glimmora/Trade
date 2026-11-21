/**
 * Data contoh strategi BRG — generator candle sintetis gold yang realistis.
 *
 * Candle dibuat dari PRNG ber-seed (mulberry32) sehingga skenario bisa
 * diulang persis; strukturnya mengikuti pola ajaran BRG: tren turun →
 * pola W (double bottom) → tren naik → pola M (double top) → koreksi.
 * Harga awal ~1940, sesuai contoh-contoh di sintesis riset
 * (`~/workspace/bangranfx/research/synthesis.md`).
 *
 * File ini murni data (tanpa React) supaya bisa dipakai chart, kalkulator,
 * maupun halaman lain.
 */

/** Satu candle. `time` dalam detik UTC (format lightweight-charts). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Zona Supply & Demand (Bab 5): gemuk / sedang / kurus, fresh atau tidak. */
export interface SndZone {
  top: number;
  bottom: number;
  kind: 'demand' | 'supply';
  fresh: boolean;
  thickness: 'gemuk' | 'sedang' | 'kurus';
  label: string;
}

/** Satu level SNR / "garis sakti" (Bab 4). */
export interface SnrLevel {
  price: number;
  label: string;
}

/** Satu titik garis (dipakai parallel channel). */
export interface ChannelPoint {
  time: number;
  price: number;
}

/** Penanda pola pembalikan W / M (Bab 6). */
export interface BrgPatternMarker {
  time: number;
  price: number;
  kind: 'W' | 'M';
}

/** Contoh setup entry/SL/TP dari sintesis riset. */
export interface BrgPreset {
  id: string;
  name: string;
  direction: 'buy' | 'sell';
  entry: number;
  sl: number;
  /** TP utama (RR 1:2 pada contoh Bab 9). */
  tp: number;
  /** TP lanjutan bila ada (mis. TP 1:3 dari penggaris Fibonacci). */
  tp2?: number;
  note: string;
}

/** Sell 1943, SL 1945 (20 pip), TP 1941 (20 pip) — contoh Bab 2 & Bab 9.
 *  Catatan: sintesis menulis "SL 10 pip" untuk contoh ini, tetapi itu
 *  tidak konsisten dengan definisi pip yang sama (10 pip = 1,00 harga);
 *  dengan 1 pip = 0,10, jarak 1943 → 1945 = 20 pip dan RR contoh ini 1:1. */
export const PRESET_SELL_1943: BrgPreset = {
  id: 'sell-1943',
  name: 'Sell 1943 — contoh Bab 9',
  direction: 'sell',
  entry: 1943,
  sl: 1945,
  tp: 1941,
  note: 'SL 20 pip di atas entry, TP 20 pip di bawah entry (RR 1:1).',
};

/**
 * Entry 1956, SL 1954 (20 pip) — contoh penggaris Fibonacci RR (Bab 9,
 * No. 38): TP 1:1 di 1958, TP 1:2 di 1960.
 */
export const PRESET_BUY_1956: BrgPreset = {
  id: 'buy-1956',
  name: 'Buy 1956 — contoh Fibonacci RR',
  direction: 'buy',
  entry: 1956,
  sl: 1954,
  tp: 1958,
  tp2: 1960,
  note: 'Jarak 0 → SL = 1R (20 pip); level 1 = TP 1:1 di 1958, level 2 = TP 1:2 di 1960.',
};

/**
 * Buy limit 1860,65 — rekap grup GC 11 Okt 2023 (Bab 13): running
 * 87–100 pip profit. SL 20 pip (maks scalping), TP 100 pip.
 */
export const PRESET_BUY_LIMIT_1860_65: BrgPreset = {
  id: 'buy-limit-1860-65',
  name: 'Buy limit 1860,65 — rekap GC 11 Okt 2023',
  direction: 'buy',
  entry: 1860.65,
  sl: 1858.65,
  tp: 1870.65,
  note: 'Buy limit di zona SND; contoh running 87–100 pip dari rekap grup.',
};

export const BRG_PRESETS: readonly BrgPreset[] = [
  PRESET_SELL_1943,
  PRESET_BUY_1956,
  PRESET_BUY_LIMIT_1860_65,
] as const;

/** PRNG ber-seed (mulberry32) — deterministik, bisa diulang. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Titik kendali skenario (indeks candle → harga target):
 * turun membentuk lembah W pertama → naik → lembah W kedua (lebih rendah,
 * aturan TF kecil Bab 6) → naik ke puncak M pertama → koreksi kecil →
 * puncak M kedua (lebih rendah, aturan TF besar) → turun.
 */
const CONTROL_POINTS: readonly (readonly [number, number])[] = [
  [0, 1940],
  [20, 1928],
  [35, 1936],
  [50, 1924],
  [75, 1958],
  [90, 1952],
  [105, 1956],
  [119, 1942],
] as const;

function targetAt(index: number): number {
  for (let i = 1; i < CONTROL_POINTS.length; i += 1) {
    const prev = CONTROL_POINTS[i - 1];
    const next = CONTROL_POINTS[i];
    if (prev === undefined || next === undefined) {
      continue;
    }
    if (index <= next[0]) {
      const span = next[0] - prev[0];
      const t = span === 0 ? 0 : (index - prev[0]) / span;
      return prev[1] + (next[1] - prev[1]) * t;
    }
  }
  const last = CONTROL_POINTS[CONTROL_POINTS.length - 1];
  return last === undefined ? 1940 : last[1];
}

/**
 * Generator candle sintetis gold (M15, 120 candle).
 * `seed` membuat skenario bisa diulang; `startTime` dalam detik UTC
 * (default 17 Nov 2026 00:00 UTC, Senin).
 */
export function generateGoldCandles(
  seed = 20261117,
  count = 120,
  startTime = 1794873600,
): Candle[] {
  const rand = mulberry32(seed);
  const stepSeconds = 15 * 60;
  const candles: Candle[] = [];
  let prevClose = 1940;
  for (let i = 0; i < count; i += 1) {
    const target = targetAt(i);
    // Random walk yang ditarik ke harga target + noise kecil.
    const drift = (target - prevClose) * 0.35;
    const noise = (rand() - 0.5) * 1.6;
    const open = prevClose;
    const close = round2(open + drift + noise);
    const wickUp = rand() * 0.9;
    const wickDown = rand() * 0.9;
    const high = round2(Math.max(open, close) + wickUp);
    const low = round2(Math.min(open, close) - wickDown);
    candles.push({ time: startTime + i * stepSeconds, open, high, low, close });
    prevClose = close;
  }
  return candles;
}

/** EMA (21/34/89 — angka Fibonacci, Bab 3) dari harga close. */
export function emaSeries(candles: readonly Candle[], period: number): number[] {
  if (period < 1 || candles.length === 0) {
    return [];
  }
  const closes = candles.map((candle) => candle.close);
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema = 0;
  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i];
    if (close === undefined) {
      continue;
    }
    if (i < period - 1) {
      // Fase pemanasan: pakai SMA berjalan sampai periode terpenuhi.
      ema = (ema * i + close) / (i + 1);
    } else if (i === period - 1) {
      ema = (ema * i + close) / (i + 1);
    } else {
      ema = close * k + ema * (1 - k);
    }
    out.push(round2(ema));
  }
  return out;
}

export interface BrgScenario {
  candles: Candle[];
  snrLevels: SnrLevel[];
  sndZones: SndZone[];
  channel: { top: ChannelPoint[]; bottom: ChannelPoint[] };
  ema: { p21: number[]; p34: number[]; p89: number[] };
  patterns: BrgPatternMarker[];
  preset: BrgPreset;
}

/**
 * Satu skenario lengkap yang siap dilempar ke BrgChart: candle sintetis
 * beserta SNR, zona SND, parallel channel, EMA 21/34/89, penanda pola
 * W/M, dan preset sell 1943.
 */
export function buildBrgExample(seed = 20261117): BrgScenario {
  const candles = generateGoldCandles(seed);
  const first = candles[0];
  const last = candles[candles.length - 1];
  const wCandle = candles[50];
  const mCandle = candles[105];
  const firstTime = first === undefined ? 1794873600 : first.time;
  const lastTime = last === undefined ? firstTime : last.time;

  const snrLevels: SnrLevel[] = [
    { price: 1958, label: 'Resistance (puncak M)' },
    { price: 1940, label: 'SNR tengah' },
    { price: 1924, label: 'Support (lembah W)' },
  ];
  const sndZones: SndZone[] = [
    {
      top: 1930,
      bottom: 1924,
      kind: 'demand',
      fresh: true,
      thickness: 'gemuk',
      label: 'Demand — lembah W',
    },
    {
      top: 1958,
      bottom: 1954,
      kind: 'supply',
      fresh: true,
      thickness: 'sedang',
      label: 'Supply — puncak M',
    },
  ];
  const channel = {
    top: [
      { time: firstTime, price: 1946 },
      { time: lastTime, price: 1966 },
    ],
    bottom: [
      { time: firstTime, price: 1932 },
      { time: lastTime, price: 1952 },
    ],
  };
  const patterns: BrgPatternMarker[] = [];
  if (wCandle !== undefined) {
    patterns.push({ time: wCandle.time, price: wCandle.low, kind: 'W' });
  }
  if (mCandle !== undefined) {
    patterns.push({ time: mCandle.time, price: mCandle.high, kind: 'M' });
  }
  return {
    candles,
    snrLevels,
    sndZones,
    channel,
    ema: {
      p21: emaSeries(candles, 21),
      p34: emaSeries(candles, 34),
      p89: emaSeries(candles, 89),
    },
    patterns,
    preset: PRESET_SELL_1943,
  };
}
