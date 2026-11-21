/**
 * Kalkulasi murni metode BRG (BangranFX) — tanpa React, tanpa efek samping.
 *
 * Sumber angka: sintesis riset 91 video @bangranfx
 * (`~/workspace/bangranfx/research/synthesis.md`, Bab 9–12).
 *
 * Konvensi XAU/USD (Bab 2 & Bab 9):
 * - 1 pip = 0,10 pergerakan harga (10 pip = 1,00; contoh 1943 → 1944).
 * - Nilai 1 pip per 1 lot = $10, sehingga rugi = lot × jarak SL (pip) × $10.
 * - Rumus lot: lot = risiko ($) / (jarak SL (pip) × 10).
 * - RR minimal 1:2; Fibonacci dipakai sebagai penggaris RR: level 0 di
 *   entry, jarak 0 → SL = "1R", level 1/2/3 = TP 1:1 / 1:2 / 1:3.
 */

/** Arah posisi. */
export type TradeDirection = 'buy' | 'sell';

/** Tipe trading BRG beserta pasangan timeframe-nya (Bab 7). */
export type TradeType = 'scalping' | 'intraday' | 'swing';

/** Pergerakan harga untuk 1 pip di XAU/USD (Bab 2). */
export const PIP_SIZE_XAUUSD = 0.1;

/** Nilai 1 pip per 1 lot standar XAU/USD, dalam USD (Bab 10). */
export const PIP_VALUE_PER_LOT_USD = 10;

/** SL maksimum per tipe trading, dalam pip (Bab 9, No. 49). */
export const SL_MAX_PIPS: Readonly<Record<TradeType, number>> = {
  scalping: 20,
  intraday: 60,
  swing: 120,
} as const;

/** Label Bahasa Indonesia untuk tiap tipe trading. */
export const TRADE_TYPE_LABELS: Readonly<Record<TradeType, string>> = {
  scalping: 'Scalping (M30 → M5 → M1)',
  intraday: 'Intraday (H4 → M30 → M15)',
  swing: 'Swing (Weekly → H4 → H1)',
} as const;

/** Jumlah pip antara dua harga XAU/USD. */
export function pipsBetween(from: number, to: number): number {
  return Math.abs(to - from) / PIP_SIZE_XAUUSD;
}

/**
 * Lot dari modal, persentase risiko, dan jarak SL (Bab 10).
 * "Risiko dulu, baru SL, baru lot — lot tercipta setelah tahu risiko."
 *
 * Contoh: modal $1.000, risiko 1% ($10), SL 10 pip → lot 0,10.
 * Hasil dibulatkan ke bawah ke 0,01 (step lot terkecil) supaya risiko
 * aktual tidak pernah melebihi risiko yang ditetapkan.
 */
export function calcLot(balance: number, riskPct: number, slPips: number): number {
  if (!Number.isFinite(balance) || balance <= 0) {
    throw new RangeError('Modal harus lebih besar dari 0.');
  }
  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    throw new RangeError('Persentase risiko harus lebih besar dari 0.');
  }
  if (!Number.isFinite(slPips) || slPips <= 0) {
    throw new RangeError('Jarak SL (pip) harus lebih besar dari 0.');
  }
  const riskUsd = (balance * riskPct) / 100;
  const lot = riskUsd / (slPips * PIP_VALUE_PER_LOT_USD);
  return Math.floor(lot * 100) / 100;
}

/** Kerugian dalam USD bila SL kena, untuk lot dan jarak SL tertentu. */
export function calcRiskUsd(lot: number, slPips: number): number {
  if (!Number.isFinite(lot) || lot < 0) {
    throw new RangeError('Lot harus 0 atau lebih besar.');
  }
  if (!Number.isFinite(slPips) || slPips < 0) {
    throw new RangeError('Jarak SL (pip) harus 0 atau lebih besar.');
  }
  return lot * slPips * PIP_VALUE_PER_LOT_USD;
}

export interface RiskReward {
  /** Jarak entry → SL, dalam pip. */
  riskPips: number;
  /** Jarak entry → TP, dalam pip (negatif bila TP di sisi yang salah). */
  rewardPips: number;
  /** rewardPips / riskPips; standar BRG minimal 2 (RR 1:2). */
  ratio: number;
  /** Alias `ratio` — dipakai modul kalkulator/wizard. */
  rr: number;
  /** True bila ratio memenuhi standar minimal BRG (≥ 2). */
  meetsMinimum: boolean;
}

/**
 * Risk:reward sebuah setup (Bab 9). Arah disimpulkan dari posisi SL
 * terhadap entry bila `direction` tidak diisi; bila diisi, reward
 * dihitung searah posisi (buy: TP − entry; sell: entry − TP).
 */
export function calcRiskReward(
  entry: number,
  sl: number,
  tp: number,
  direction?: TradeDirection,
): RiskReward {
  if (![entry, sl, tp].every(Number.isFinite)) {
    throw new RangeError('Entry, SL, dan TP harus angka yang valid.');
  }
  const riskPips = pipsBetween(entry, sl);
  if (riskPips === 0) {
    throw new RangeError('SL tidak boleh sama dengan entry.');
  }
  const rewardPips =
    direction === undefined
      ? pipsBetween(entry, tp)
      : direction === 'buy'
        ? (tp - entry) / PIP_SIZE_XAUUSD
        : (entry - tp) / PIP_SIZE_XAUUSD;
  const ratio = rewardPips / riskPips;
  return { riskPips, rewardPips, ratio, rr: ratio, meetsMinimum: ratio >= 2 };
}

export interface FibRrLevel {
  /** Level penggaris RR: 0 = entry, 1 = TP 1:1, 2 = TP 1:2, 3 = TP 1:3. */
  level: 0 | 1 | 2 | 3;
  /** Harga pada level tersebut. */
  price: number;
  /** Label Bahasa Indonesia, mis. "TP 1:2". */
  label: string;
}

/**
 * Fibonacci sebagai penggaris RR (Bab 9, No. 38): level 0 di titik entry,
 * tarik sampai ke SL (jarak 0 → SL = "1R"); level 1/2/3 adalah kelipatan
 * jarak tersebut ke arah TP.
 *
 * Contoh: entry 1956, SL 1954 (20 pip), buy → TP 1:1 di 1958, TP 1:2 di 1960.
 */
export function fibRrLevels(
  entry: number,
  sl: number,
  direction: TradeDirection,
): FibRrLevel[] {
  if (![entry, sl].every(Number.isFinite)) {
    throw new RangeError('Entry dan SL harus angka yang valid.');
  }
  const risk = Math.abs(entry - sl);
  if (risk === 0) {
    throw new RangeError('SL tidak boleh sama dengan entry.');
  }
  const sign = direction === 'buy' ? 1 : -1;
  const labels: Readonly<Record<FibRrLevel['level'], string>> = {
    0: 'Entry (0R)',
    1: 'TP 1:1',
    2: 'TP 1:2',
    3: 'TP 1:3',
  };
  const levels: FibRrLevel['level'][] = [0, 1, 2, 3];
  return levels.map((level) => ({
    level,
    price: entry + sign * risk * level,
    label: labels[level],
  }));
}

/**
 * SL maksimum per tipe trading, dalam pip (Bab 9, No. 49).
 * Zone yang butuh SL lebih lebar dari ini bukan zone yang bagus — jangan OP.
 */
export function slMaxFor(type: TradeType): number {
  return SL_MAX_PIPS[type];
}

export interface LayeringSplit {
  /** Lot tiap layer, berurutan dari atas ke bawah zona SND. */
  layers: number[];
  /** Jumlah semua layer — sama dengan totalLot (setelah pembulatan). */
  total: number;
}

/**
 * Layering persentase (Bab 12, No. 60): total lot dihitung dulu dari
 * batas rugi, baru dibagi rata ke layer (maksimal 5 layer dalam satu zone).
 * Pembulatan ke 0,01; sisa pembulatan ditaruh di layer terakhir supaya
 * jumlahnya tetap sama dengan totalLot.
 */
export function layeringPercent(totalLot: number, layers: number): LayeringSplit {
  if (!Number.isFinite(totalLot) || totalLot <= 0) {
    throw new RangeError('Total lot harus lebih besar dari 0.');
  }
  if (!Number.isInteger(layers) || layers < 1 || layers > 5) {
    throw new RangeError('Jumlah layer harus bilangan bulat 1–5.');
  }
  const roundedTotal = Math.round(totalLot * 100) / 100;
  const perLayer = Math.floor((roundedTotal / layers) * 100) / 100;
  const split: number[] = Array.from({ length: layers }, () => perLayer);
  const remainder = Math.round((roundedTotal - perLayer * layers) * 100) / 100;
  const last = split[layers - 1];
  if (last !== undefined) {
    split[layers - 1] = Math.round((last + remainder) * 100) / 100;
  }
  return { layers: split, total: roundedTotal };
}

export interface CompoundingStep {
  /** Nomor step, mulai dari 1. */
  step: number;
  /** Saldo di awal step, sebelum risiko dihitung. */
  balanceBefore: number;
  /** Saldo di akhir step bila step menang (RR 1:1: untung = risiko). */
  balance: number;
  /** Alias `balance` — saldo akhir step. */
  balanceAfter: number;
  /** Risiko pada step ini, dalam USD. */
  riskUsd: number;
}

/**
 * Compounding per step (Bab 11, No. 79): profit tidak di-withdraw,
 * ditambahkan ke modal dan ditradingkan lagi. Tiap step menang dengan
 * RR 1:1 (TP = SL), jadi saldo bertambah sebesar risiko step itu
 * (risiko = riskPct% dari saldo awal step).
 *
 * Contoh acuan video: $20 dengan risiko 30%/step selama 20 step
 * (dengan TP 1:2 pada sebagian step, hasil yang diklaim $2.926).
 */
export function compoundingSteps(
  start: number,
  riskPct: number,
  steps: number,
): CompoundingStep[] {
  if (!Number.isFinite(start) || start <= 0) {
    throw new RangeError('Modal awal harus lebih besar dari 0.');
  }
  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    throw new RangeError('Persentase risiko harus lebih besar dari 0.');
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError('Jumlah step harus bilangan bulat 1 atau lebih.');
  }
  const out: CompoundingStep[] = [];
  let balance = Math.round(start * 100) / 100;
  for (let step = 1; step <= steps; step += 1) {
    const risk = Math.round(((balance * riskPct) / 100) * 100) / 100;
    const after = Math.round((balance + risk) * 100) / 100;
    out.push({ step, balanceBefore: balance, balance: after, balanceAfter: after, riskUsd: risk });
    balance = after;
  }
  return out;
}
