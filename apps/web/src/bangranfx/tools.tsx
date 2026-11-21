/**
 * Kalkulator Metode BRG (BangranFX) — Modul B.
 *
 * Semua angka/metode di sini diringkas dari riset transkrip 91 video
 * @bangranfx (lihat ~/workspace/bangranfx/research/synthesis.md, Bab 4-14).
 * Semua klaim profit di video adalah KLAIM PEMBICARA, bukan fakta
 * terverifikasi independen — pesan itu ditulis di UI, bukan hanya di sini.
 *
 * Hitungan memakai ../bangranfx/calc.ts (dibuat agen paralel) — signature ASLI
 * (dicek 22 Nov 2026, cocok dengan calc.test.ts):
 *   calcLot(balanceUsd, riskPercent, slPips) -> lot (number)
 *     Konvensi emas: 1 pip = 0,10 harga (10 pip = 1,00); nilai 1 pip per
 *     1 lot = $10, jadi rugi = lot x jarak SL (pip) x $10, dan
 *     lot = risiko ($) / (jarak SL (pip) x 10).
 *     Contoh: $1.000 x 1% = $10, SL 10 pip -> lot 0,10.
 *     MELEMPAR RangeError bila input <= 0 — komponen di sini memakai
 *     pembungkus aman (safeCalcLot dst.) supaya input kosong/tidak valid
 *     tidak meruntuhkan render.
 *   calcRiskReward(entry, sl, tp) -> { riskPips, rewardPips, ratio, meetsMinimum }
 *     (tanpa parameter arah — arah disimpulkan dari posisi SL vs entry).
 *   fibRrLevels(entry, sl, direction) -> [{ level: 0|1|2|3, label, price }]
 *     Fibonacci sebagai penggaris RR: 0 di entry, jarak 0->SL = 1R,
 *     level 1 = TP 1:1, level 2 = TP 1:2, level 3 = TP 1:3.
 *   calcRiskUsd(lot, slPips) -> rugi $ bila SL kena.
 *   slMaxFor(type) -> SL maksimal (pip) per tipe trading
 *     ('scalping' -> 20, 'intraday' -> 60, 'swing' -> 120).
 *   layeringPercent(totalLot, layers) -> { layers: number[], total: number }
 *   compoundingSteps(startBalance, riskPercent, steps)
 *     -> [{ step, balanceBefore, riskUsd, balanceAfter }]
 *     (tiap step menang RR 1:1: saldo bertambah sebesar risiko step itu).
 * Data/preset memakai ../bangranfx/data.ts (tipe Candle, SndZone, SnrLevel,
 * preset PRESET_SELL_1943 & PRESET_BUY_1956).
 */
import { useId, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  calcLot,
  calcRiskReward,
  calcRiskUsd,
  compoundingSteps,
  fibRrLevels,
  layeringPercent,
  slMaxFor,
} from './calc';
import type { CompoundingStep, FibRrLevel, LayeringSplit, RiskReward } from './calc';
import {
  PRESET_BUY_1956,
  PRESET_BUY_LIMIT_1860_65,
  PRESET_SELL_1943,
} from './data';

/**
 * Pembungkus aman untuk fungsi calc.ts: fungsi-fungsi itu melempar RangeError
 * pada input tidak valid (mis. SL = 0 saat pengguna mengosongkan field).
 * Di UI live, input tidak valid menampilkan "—" / tabel kosong, bukan crash.
 */
export function safeCalcLot(
  balance: number,
  riskPct: number,
  slPips: number,
): number | null {
  try {
    return calcLot(balance, riskPct, slPips);
  } catch {
    return null;
  }
}

export function safeFibLevels(
  entry: number,
  sl: number,
  direction: BrgDirection,
): FibRrLevel[] {
  try {
    return fibRrLevels(entry, sl, direction);
  } catch {
    return [];
  }
}

export function safeRiskReward(
  entry: number,
  sl: number,
  tp: number,
): RiskReward | null {
  try {
    return calcRiskReward(entry, sl, tp);
  } catch {
    return null;
  }
}

export function safeLayering(
  totalLot: number,
  layers: number,
): LayeringSplit | null {
  try {
    return layeringPercent(totalLot, layers);
  } catch {
    return null;
  }
}

export function safeCompounding(
  start: number,
  riskPct: number,
  steps: number,
): CompoundingStep[] {
  try {
    return compoundingSteps(start, riskPct, steps);
  } catch {
    return [];
  }
}

export type BrgDirection = 'buy' | 'sell';
export type BrgTradingType = 'scalping' | 'intraday' | 'swing';

export const TRADING_TYPES: readonly {
  id: BrgTradingType;
  label: string;
  slMax: number;
  note: string;
}[] = [
  {
    id: 'scalping',
    label: 'Scalping',
    slMax: 20,
    note: 'Praktik scalping biasanya SL 11–15 pip.',
  },
  {
    id: 'intraday',
    label: 'Intraday',
    slMax: 60,
    note: 'Bila zona butuh SL lebih lebar, zona itu bukan zona yang bagus — jangan OP.',
  },
  {
    id: 'swing',
    label: 'Swing',
    slMax: 120,
    note: 'SL ideal di atas support/resistance sebelumnya, ditambah sedikit buffer lalu dibulatkan.',
  },
] as const;

/* ---------- Primitif UI bersama (dipakai tools.tsx, wizards.tsx, session.tsx) ---------- */

export const brgCard: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1rem',
  marginBottom: '1rem',
};

export const brgGrid: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

export const brgField: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  marginBottom: '0.75rem',
};

export const brgInput: CSSProperties = {
  minHeight: 44,
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  background: 'var(--bg)',
  color: 'var(--text)',
  width: '100%',
};

export const brgSelect: CSSProperties = { ...brgInput };

export const brgButton: CSSProperties = {
  minHeight: 44,
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--accent-text)',
  fontWeight: 600,
  cursor: 'pointer',
};

export const brgButtonSecondary: CSSProperties = {
  ...brgButton,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
};

export const brgResult: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  padding: '0.75rem',
  marginTop: '0.75rem',
};

export const brgNote: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.85rem',
  marginTop: '0.5rem',
};

export const brgWarning: CSSProperties = {
  background: 'var(--surface)',
  border: '2px solid var(--danger)',
  borderRadius: '0.5rem',
  padding: '0.75rem',
  marginTop: '0.75rem',
  color: 'var(--text)',
};

export const brgTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};

export const brgTh: CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  padding: '0.4rem 0.5rem',
  color: 'var(--muted)',
};

export const brgTd: CSSProperties = {
  borderBottom: '1px solid var(--border)',
  padding: '0.4rem 0.5rem',
};

export const brgMuted: CSSProperties = { color: 'var(--muted)' };

/** Format angka dengan jumlah desimal tetap, memakai pemisah ribuan en-US. */
export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtUsd(n: number): string {
  return `$${fmt(n, 2)}`;
}

/** Catatan kejujuran standar: klaim profit video bukan fakta terverifikasi. */
export function ClaimDisclaimer(): ReactElement {
  return (
    <p style={brgNote}>
      Semua angka profit, challenge, dan win rate yang disebut di video adalah klaim
      pembicara, bukan fakta terverifikasi secara independen. Hitungan di atas hanya
      aritmetika dari angka yang Anda masukkan — bukan janji profit.
    </p>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

/** Input angka berlabel lengkap (htmlFor/id) dengan min/step yang masuk akal. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: NumberFieldProps): ReactElement {
  return (
    <div style={brgField}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        style={brgInput}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
      {hint ? <small style={brgMuted}>{hint}</small> : null}
    </div>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  hint?: string;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: SelectFieldProps): ReactElement {
  return (
    <div style={brgField}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        style={brgSelect}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <small style={brgMuted}>{hint}</small> : null}
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }): ReactElement {
  return <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{children}</h2>;
}

/* ---------- LotCalculator ---------- */

/**
 * Bab 10 (sintesis): lot ditentukan kesiapan rugi, bukan besar modal.
 * Urutan: modal -> risiko% -> jarak SL -> lot. Semakin besar SL, semakin kecil lot.
 * Contoh terverifikasi: modal $1.000, risiko 1% ($10), SL 10 pip -> lot 0,10.
 */
export function LotCalculator(): ReactElement {
  const uid = useId();
  const [balance, setBalance] = useState(1000);
  const [riskPct, setRiskPct] = useState(1);
  const [slPips, setSlPips] = useState(10);
  const [type, setType] = useState<BrgTradingType>('scalping');

  const riskUsd = (balance * riskPct) / 100;
  const lot = useMemo(
    () => safeCalcLot(balance, riskPct, slPips),
    [balance, riskPct, slPips],
  );
  const maxSl = slMaxFor(type);
  const chances = riskPct > 0 ? Math.floor(100 / riskPct) : 0;
  const overStandard = slPips > maxSl;

  return (
    <section style={brgCard} aria-labelledby={`${uid}-lot-heading`}>
      <SectionHeading>
        <span id={`${uid}-lot-heading`}>Kalkulator Lot</span>
      </SectionHeading>
      <p style={brgMuted}>
        Lot tercipta setelah kita tahu risiko: modal → risiko% → jarak SL → lot.
        Tidak ada patokan lot dari modal.
      </p>
      <div style={brgGrid}>
        <NumberField
          id={`${uid}-balance`}
          label="Modal (USD)"
          value={balance}
          onChange={setBalance}
          min={1}
          step={10}
          hint="Uang dingin / siap hilang, bukan uang hidup sehari-hari."
        />
        <NumberField
          id={`${uid}-risk`}
          label="Risiko per trade (%)"
          value={riskPct}
          onChange={setRiskPct}
          min={0.1}
          max={100}
          step={0.1}
          hint="1% = modal habis dalam 100× OP; 2% = 50× OP."
        />
        <NumberField
          id={`${uid}-sl`}
          label="Jarak stop loss (pip)"
          value={slPips}
          onChange={setSlPips}
          min={1}
          max={500}
          step={1}
          hint="Di gold: 10 pip = perubahan harga 1,00."
        />
        <SelectField
          id={`${uid}-type`}
          label="Tipe trading (standar SL)"
          value={type}
          onChange={(value) => {
            setType(value as BrgTradingType);
          }}
          options={TRADING_TYPES.map((entry) => ({
            value: entry.id,
            label: `${entry.label} (maks ${String(entry.slMax)} pip)`,
          }))}
        />
      </div>
      <div style={brgResult} aria-live="polite">
        <p>
          <strong>Lot: {lot === null ? '—' : fmt(lot, 2)}</strong>
        </p>
        <p>
          Risiko: {fmtUsd(riskUsd)} per trade ({fmt(riskPct, 1)}% dari modal).
        </p>
        <p>
          Kesempatan: modal habis setelah ±{chances}× OP bila semua loss (tanpa
          profit).
        </p>
        <p style={brgMuted}>
          Semakin besar SL, semakin kecil lot — contoh: SL 20 pip dengan risiko $10
          → lot 0,05.
        </p>
      </div>
      {overStandard ? (
        <div style={brgWarning} role="alert">
          <strong>Peringatan:</strong> SL {slPips} pip melebihi standar {type} (maks{' '}
          {maxSl} pip). Menurut metode BRG, bila zona membutuhkan SL lebih lebar dari
          standar, zona itu bukan zona yang bagus — jangan OP.
        </div>
      ) : null}
      <ClaimDisclaimer />
    </section>
  );
}

/* ---------- SlTpRrCalculator ---------- */

/**
 * Bab 9 (sintesis): Fibonacci sebagai penggaris RR — 0 di entry, jarak 0->SL = 1R,
 * level 1 = TP 1:1, level 2 = TP 1:2, level 3 = TP 1:3.
 * Contoh terverifikasi: entry 1956, SL 1954 (20 pip) -> TP 1:1 di 1958,
 * TP 1:2 di 1960. Contoh sell: 1943, SL 1945, TP 1941 (20 pip risiko,
 * 20 pip reward, RR 1:1 — di bawah standar minimal 1:2; TP 1:2-nya 1939).
 */
export function SlTpRrCalculator(): ReactElement {
  const uid = useId();
  const [direction, setDirection] = useState<BrgDirection>('sell');
  const [entry, setEntry] = useState(1943);
  const [sl, setSl] = useState(1945);

  const levels = useMemo(
    () => safeFibLevels(entry, sl, direction),
    [entry, sl, direction],
  );
  const tp2 = levels.find((level) => level.level === 2);
  const rrAtTp2 = useMemo(
    () =>
      tp2 !== undefined ? safeRiskReward(entry, sl, tp2.price) : null,
    [entry, sl, tp2],
  );
  const slPips = Math.abs(entry - sl) * 10;

  return (
    <section style={brgCard} aria-labelledby={`${uid}-sltp-heading`}>
      <SectionHeading>
        <span id={`${uid}-sltp-heading`}>Kalkulator SL / TP / RR</span>
      </SectionHeading>
      <p style={brgMuted}>
        Fibonacci sebagai penggaris RR: 0 di entry, jarak 0→SL = 1R. Level 1 = TP
        1:1, level 2 = TP 1:2, level 3 = TP 1:3. RR minimal 1:2.
      </p>
      <div style={brgGrid}>
        <SelectField
          id={`${uid}-direction`}
          label="Arah posisi"
          value={direction}
          onChange={(value) => {
            setDirection(value as BrgDirection);
          }}
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
          ]}
        />
        <NumberField
          id={`${uid}-entry`}
          label="Harga entry (XAU/USD)"
          value={entry}
          onChange={setEntry}
          min={0}
          step={0.5}
        />
        <NumberField
          id={`${uid}-sl`}
          label="Harga stop loss (XAU/USD)"
          value={sl}
          onChange={setSl}
          min={0}
          step={0.5}
          hint="Buy: SL di bawah support terdekat. Sell: SL di atas resistance terdekat, ditambah buffer lalu dibulatkan."
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={brgButtonSecondary}
          onClick={() => {
            setDirection(PRESET_SELL_1943.direction);
            setEntry(PRESET_SELL_1943.entry);
            setSl(PRESET_SELL_1943.sl);
          }}
        >
          Preset: {PRESET_SELL_1943.name}
        </button>
        <button
          type="button"
          style={brgButtonSecondary}
          onClick={() => {
            setDirection(PRESET_BUY_1956.direction);
            setEntry(PRESET_BUY_1956.entry);
            setSl(PRESET_BUY_1956.sl);
          }}
        >
          Preset: {PRESET_BUY_1956.name}
        </button>
        <button
          type="button"
          style={brgButtonSecondary}
          onClick={() => {
            setDirection(PRESET_BUY_LIMIT_1860_65.direction);
            setEntry(PRESET_BUY_LIMIT_1860_65.entry);
            setSl(PRESET_BUY_LIMIT_1860_65.sl);
          }}
        >
          Preset: {PRESET_BUY_LIMIT_1860_65.name}
        </button>
      </div>
      <div style={brgResult} aria-live="polite">
        <p>
          Jarak SL: <strong>{fmt(slPips, 0)} pip</strong> ({fmt(Math.abs(entry - sl), 2)}{' '}
          harga).
        </p>
        {levels.length > 0 ? (
          <table style={brgTable}>
            <thead>
              <tr>
                <th scope="col" style={brgTh}>
                  Level
                </th>
                <th scope="col" style={brgTh}>
                  TP (RR)
                </th>
                <th scope="col" style={brgTh}>
                  Harga
                </th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.level}>
                  <th scope="row" style={brgTd}>
                    {level.level}
                  </th>
                  <td style={brgTd}>{level.label}</td>
                  <td style={brgTd}>{fmt(level.price, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Isi entry dan SL yang berbeda untuk melihat level TP.</p>
        )}
        {rrAtTp2 !== null ? (
          <p>
            Di TP 1:2 — risiko {fmt(rrAtTp2.riskPips, 0)} pip, reward{' '}
            {fmt(rrAtTp2.rewardPips, 0)} pip, RR 1:{fmt(rrAtTp2.ratio, 2)}.
          </p>
        ) : null}
      </div>
      <p style={brgNote}>
        Bila posisi running 10–15 pip, pindahkan SL ke BEP (harga entry). Saat TP1
        kena → SL ke BEP; menuju TP2 → SL ke TP1; menuju TP3 → SL ke TP2 (SL plus).
      </p>
      <ClaimDisclaimer />
    </section>
  );
}

/* ---------- LayeringCalculator ---------- */

/**
 * Bab 12 (sintesis): layering = beberapa lapis posisi dalam satu zone,
 * maksimal 5 layer. Persentase: total lot dihitung dari batas rugi, baru dibagi
 * ke layer. Full margin: lot berjenjang dari modal kecil — HANYA dengan dana
 * profit, bukan uang terakhir.
 */
export function LayeringCalculator(): ReactElement {
  const uid = useId();
  const [totalLot, setTotalLot] = useState(0.5);
  const [layers, setLayers] = useState(5);
  const [mode, setMode] = useState<'persentase' | 'fullmargin'>('persentase');
  const [slPips, setSlPips] = useState(20);
  const [riskUsd, setRiskUsd] = useState(100);

  const split = useMemo(
    () => safeLayering(totalLot, layers),
    [totalLot, layers],
  );
  const perLayer = split === null ? [] : split.layers;
  const maxLot = totalLot / Math.max(layers, 1);

  return (
    <section style={brgCard} aria-labelledby={`${uid}-layer-heading`}>
      <SectionHeading>
        <span id={`${uid}-layer-heading`}>Kalkulator Layering</span>
      </SectionHeading>
      <p style={brgMuted}>
        Buka beberapa lapis posisi di dalam satu zona SND — maksimal 5 layer dalam
        satu zone. Layer hanya ditambah saat harga sudah running.
      </p>
      <div style={brgGrid}>
        <NumberField
          id={`${uid}-totallot`}
          label="Total lot (dihitung dari batas rugi)"
          value={totalLot}
          onChange={setTotalLot}
          min={0.01}
          step={0.01}
          hint="Contoh: risiko $100, SL 20 pip → lot maksimal 0,50."
        />
        <NumberField
          id={`${uid}-layers`}
          label="Jumlah layer (maks 5)"
          value={layers}
          onChange={(value) => {
            setLayers(Math.min(5, Math.max(1, Math.round(value))));
          }}
          min={1}
          max={5}
          step={1}
          hint="Lewat dari 5 layer tidak boleh OP lagi di zona yang sama."
        />
        <NumberField
          id={`${uid}-risk`}
          label="Batas rugi total (USD)"
          value={riskUsd}
          onChange={setRiskUsd}
          min={1}
          step={10}
        />
        <NumberField
          id={`${uid}-sl`}
          label="Jarak SL (pip)"
          value={slPips}
          onChange={setSlPips}
          min={1}
          max={120}
          step={1}
        />
        <SelectField
          id={`${uid}-mode`}
          label="Mode layering"
          value={mode}
          onChange={(value) => {
            setMode(value as 'persentase' | 'fullmargin');
          }}
          options={[
            { value: 'persentase', label: 'Persentase (lot dari batas rugi)' },
            { value: 'fullmargin', label: 'Full margin (lot berjenjang)' },
          ]}
        />
      </div>
      <div style={brgResult} aria-live="polite">
        {mode === 'persentase' ? (
          <>
            <p>
              Total lot {fmt(totalLot, 2)} dibagi {layers} layer →{' '}
              <strong>{fmt(totalLot / Math.max(layers, 1), 2)} lot per layer</strong>,
              masuk bertahap dari atas ke bawah zona SND.
            </p>
            <table style={brgTable}>
              <thead>
                <tr>
                  <th scope="col" style={brgTh}>
                    Layer
                  </th>
                  <th scope="col" style={brgTh}>
                    Lot
                  </th>
                  <th scope="col" style={brgTh}>
                    Risiko maks layer ini*
                  </th>
                </tr>
              </thead>
              <tbody>
                {perLayer.map((lot, index) => (
                  <tr key={index}>
                    <th scope="row" style={brgTd}>
                      {index + 1}
                    </th>
                    <td style={brgTd}>{fmt(lot, 2)}</td>
                    <td style={brgTd}>{fmtUsd(calcRiskUsd(lot, slPips))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={brgNote}>
              *Risiko per layer = lot × jarak SL × $10 (nilai 1 pip per 1 lot).
              Keuntungan layering persentase: bila SL kena, kerugian aktual
              biasanya kurang dari {fmtUsd(riskUsd)} karena layer bawah jarak
              SL-nya lebih pendek. Kelemahan: bila harga langsung terbang tanpa
              menyentuh layer bawah, posisi yang terbuka lebih kecil.
            </p>
          </>
        ) : (
          <>
            <p>
              Full margin: lot berjenjang dari kecil ke besar (mis. 0,02 → 0,03 →
              0,04 → maks 0,05) seiring harga naik mendekati batas atas zona. Saat
              harga running ke TP, close sebagian dari bawah, sisakan 1–2 posisi,
              dan geser SL mengikuti harga (trailing) sampai SL plus.
            </p>
            <p>
              Lot terbesar per layer (batas): <strong>{fmt(maxLot, 2)}</strong> bila
              total {fmt(totalLot, 2)} dibagi {layers} layer.
            </p>
          </>
        )}
      </div>
      {mode === 'fullmargin' ? (
        <div style={brgWarning} role="alert">
          <strong>Peringatan:</strong> full margin hanya boleh dengan dana profit
          dari modal utama — bukan uang terakhir atau uang kebutuhan. Bila kena SL di
          awal, akun itu habis (sudah diperhitungkan); lanjut ke akun berikutnya.
          Jangan tambah posisi saat belum running — floating bisa menghabiskan modal.
        </div>
      ) : null}
      <ClaimDisclaimer />
    </section>
  );
}

/* ---------- MmCalculator ---------- */

/**
 * Bab 11 (sintesis): deposit 30% dari total uang, 70% cadangan; dana deposit
 * dibagi jumlah kesempatan. MM persentase (risiko 1%/trade) vs MM hop-plus
 * (all-in bertahap untuk modal kecil). Compounding 20 step $20 -> $2.926
 * (risiko 30%/step) ditampilkan sebagai HASIL HITUNGAN, bukan janji profit.
 */
export function MmCalculator(): ReactElement {
  const uid = useId();
  const [totalMoney, setTotalMoney] = useState(10_000_000);
  const [chances, setChances] = useState(10);
  const [startBalance, setStartBalance] = useState(20);
  const [compoundRisk, setCompoundRisk] = useState(30);
  const [compoundStepsCount, setCompoundStepsCount] = useState(20);

  const deposit = totalMoney * 0.3;
  const reserve = totalMoney * 0.7;
  const perChance = deposit / Math.max(chances, 1);
  const maxLoss = totalMoney * 0.3;
  const table = useMemo(
    () => safeCompounding(startBalance, compoundRisk, compoundStepsCount),
    [startBalance, compoundRisk, compoundStepsCount],
  );
  const finalRow = table.length > 0 ? table[table.length - 1] : undefined;

  return (
    <section style={brgCard} aria-labelledby={`${uid}-mm-heading`}>
      <SectionHeading>
        <span id={`${uid}-mm-heading`}>Kalkulator Money Management</span>
      </SectionHeading>
      <p style={brgMuted}>
        Trading berbicara risiko dulu baru keuntungan. Uang yang didepositkan harus
        uang yang siap hilang; di luar deposit harus ada cadangan.
      </p>
      <div style={brgGrid}>
        <NumberField
          id={`${uid}-total`}
          label="Total uang (Rp)"
          value={totalMoney}
          onChange={setTotalMoney}
          min={100_000}
          step={100_000}
          hint="Seluruh uang yang dimiliki — bukan hanya yang akan didepositkan."
        />
        <NumberField
          id={`${uid}-chances`}
          label="Jumlah kesempatan (trade)"
          value={chances}
          onChange={(value) => {
            setChances(Math.max(1, Math.round(value)));
          }}
          min={1}
          max={100}
          step={1}
          hint="Dana deposit dibagi menjadi jumlah trade yang direncanakan."
        />
      </div>
      <div style={brgResult} aria-live="polite">
        <p>
          Deposit (30%): <strong>Rp{fmt(deposit, 0)}</strong>
        </p>
        <p>
          Cadangan di rekening (70%): <strong>Rp{fmt(reserve, 0)}</strong>
        </p>
        <p>
          Per kesempatan: <strong>Rp{fmt(perChance, 0)}</strong> ({chances}× OP).
        </p>
        <p>
          Batas rugi total (contoh 30% dari total uang):{' '}
          <strong>Rp{fmt(maxLoss, 0)}</strong> — bila batas ini kena, berhenti dan
          evaluasi.
        </p>
      </div>

      <h3>MM persentase vs MM hop-plus</h3>
      <table style={brgTable}>
        <thead>
          <tr>
            <th scope="col" style={brgTh}>
              Jalur
            </th>
            <th scope="col" style={brgTh}>
              Cocok untuk
            </th>
            <th scope="col" style={brgTh}>
              Aturan
            </th>
            <th scope="col" style={brgTh}>
              Risiko
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" style={brgTd}>
              MM persentase
            </th>
            <td style={brgTd}>Modal sudah besar</td>
            <td style={brgTd}>
              Risiko 1% per trade; SL dari chart; lot dihitung dari risiko.
              Akumulasi dinilai dari total 10 trade: 6 win × 2R − 4 loss × 1R = +8R.
            </td>
            <td style={brgTd}>1% / trade</td>
          </tr>
          <tr>
            <th scope="row" style={brgTd}>
              MM hop-plus
            </th>
            <td style={brgTd}>Modal kecil (&ldquo;tidak ada harapan&rdquo;, pasrah)</td>
            <td style={brgTd}>
              Modal dibagi dua akun; masing-masing di-all-in-kan bertahap dengan
              target kecil: $500 → cari 10 pip → $1.000 → $2.000 → $4.000. Bila
              akun pertama gagal, masih ada akun kedua. Setelah profit besar,
              withdraw, bagi lagi, ulangi; setelah modal besar, pindah ke MM
              persentase.
            </td>
            <td style={brgTd}>All-in bertahap (sangat besar)</td>
          </tr>
        </tbody>
      </table>
      <p style={brgNote}>
        Kontradiksi di dalam channel, ditampilkan apa adanya: video No. 71/76 memakai
        risiko 1% per trade, sedangkan No. 79 memakai risiko 30% per step — dua jalur
        untuk situasi berbeda, bukan satu aturan.
      </p>

      <h3>Tabel compounding (hasil hitungan, bukan janji)</h3>
      <div style={brgGrid}>
        <NumberField
          id={`${uid}-start`}
          label="Modal awal compounding (USD)"
          value={startBalance}
          onChange={setStartBalance}
          min={1}
          step={1}
        />
        <NumberField
          id={`${uid}-crisk`}
          label="Risiko per step (%)"
          value={compoundRisk}
          onChange={setCompoundRisk}
          min={1}
          max={100}
          step={1}
          hint="Contoh video No. 79: 30% per step, SL 20 pip / TP 20 pip."
        />
        <NumberField
          id={`${uid}-csteps`}
          label="Jumlah step"
          value={compoundStepsCount}
          onChange={(value) => {
            setCompoundStepsCount(Math.max(1, Math.round(value)));
          }}
          min={1}
          max={50}
          step={1}
        />
      </div>
      <div style={brgResult} aria-live="polite">
        {table.length > 0 ? (
          <>
            <p>
              Setelah {table.length} step, saldo hitungan:{' '}
              <strong>
                {finalRow !== undefined ? fmtUsd(finalRow.balanceAfter) : '—'}
              </strong>{' '}
              (dari {fmtUsd(startBalance)}, risiko {compoundRisk}% per step,
              tiap step menang RR 1:1).
            </p>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table style={brgTable}>
                <thead>
                  <tr>
                    <th scope="col" style={brgTh}>
                      Step
                    </th>
                    <th scope="col" style={brgTh}>
                      Saldo
                    </th>
                    <th scope="col" style={brgTh}>
                      Risiko step itu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row.step}>
                      <th scope="row" style={brgTd}>
                        {row.step}
                      </th>
                      <td style={brgTd}>{fmtUsd(row.balanceAfter)}</td>
                      <td style={brgTd}>{fmtUsd(row.riskUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>Isi modal awal, risiko, dan jumlah step untuk melihat tabel.</p>
        )}
      </div>
      <div style={brgWarning} role="alert">
        <strong>Ini hitungan, bukan janji profit.</strong> Tabel di atas mengasumsikan
        setiap step menang — kenyataannya satu step kalah memotong saldo sebesar
        risiko step itu, dan syarat yang disebut di video adalah &ldquo;teknik
        berakurasi tinggi&rdquo;. Jangan withdraw profit di tengah fase grow menurut
        video, tetapi jangan pula mempertaruhkan uang yang tidak siap hilang.
        Angka $20 → $2.926 dalam 20 step adalah klaim pembicara, bukan hasil
        terverifikasi — dan hitungan murni RR 1:1 di atas justru memberi{' '}
        {finalRow !== undefined ? fmtUsd(finalRow.balanceAfter) : '—'} setelah{' '}
        {table.length} step, jadi klaim itu bahkan tidak cocok dengan
        parameternya sendiri (menurut calc.ts, klaim tersebut melibatkan TP 1:2
        di sebagian step).
      </div>
      <ClaimDisclaimer />
    </section>
  );
}

/* ---------- MtfGuide ---------- */

/**
 * Bab 7 (sintesis): pasangan TF per tipe trading.
 * Scalping M30 -> M5 -> M1; intraday H4 -> M30 -> M15; swing Weekly -> H4 -> H1.
 */
const MTF_ROWS: readonly {
  type: BrgTradingType;
  label: string;
  major: string;
  confirmation: string;
  entry: string;
  note: string;
}[] = [
  {
    type: 'scalping',
    label: 'Scalping',
    major: 'M30',
    confirmation: 'M5',
    entry: 'M1',
    note: 'Dari M30 langsung ke M5 — M15 dilewati karena "perbandingannya cuma satu candle".',
  },
  {
    type: 'intraday',
    label: 'Intraday',
    major: 'H4',
    confirmation: 'M30',
    entry: 'M15',
    note: 'SND intraday biasanya muncul 1–2 kali sehari; yang "running" jauh biasanya hanya satu.',
  },
  {
    type: 'swing',
    label: 'Swing',
    major: 'Weekly',
    confirmation: 'H4',
    entry: 'H1',
    note: 'SNR terkuat di weekly: bila harga sampai sana dan tidak tembus akan berbalik; bila tembus, lanjut kencang.',
  },
] as const;

export function MtfGuide(): ReactElement {
  const uid = useId();
  const [type, setType] = useState<BrgTradingType>('scalping');
  const selected =
    MTF_ROWS.find((row) => row.type === type) ?? MTF_ROWS[0];
  const maxSl = selected !== undefined ? slMaxFor(selected.type) : 0;

  return (
    <section style={brgCard} aria-labelledby={`${uid}-mtf-heading`}>
      <SectionHeading>
        <span id={`${uid}-mtf-heading`}>Panduan Multi-Timeframe (MTF)</span>
      </SectionHeading>
      <p style={brgMuted}>
        Tentukan TF besar dulu baru TF kecil — jangan kebalik. TF besar menentukan
        arah, TF kecil untuk entry agar SL kecil.
      </p>
      <div style={brgField}>
        <label htmlFor={`${uid}-type`}>Pilih tipe trading</label>
        <select
          id={`${uid}-type`}
          style={brgSelect}
          value={type}
          onChange={(event) => {
            setType(event.target.value as BrgTradingType);
          }}
        >
          {MTF_ROWS.map((row) => (
            <option key={row.type} value={row.type}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      <table style={brgTable}>
        <thead>
          <tr>
            <th scope="col" style={brgTh}>
              Tipe
            </th>
            <th scope="col" style={brgTh}>
              TF major (arah)
            </th>
            <th scope="col" style={brgTh}>
              TF konfirmasi
            </th>
            <th scope="col" style={brgTh}>
              TF entry (OP)
            </th>
            <th scope="col" style={brgTh}>
              SL maks
            </th>
          </tr>
        </thead>
        <tbody>
          {MTF_ROWS.map((row) => (
            <tr
              key={row.type}
              style={
                row.type === type
                  ? { background: 'var(--surface-2)' }
                  : undefined
              }
            >
              <th scope="row" style={brgTd}>
                {row.label}
              </th>
              <td style={brgTd}>{row.major}</td>
              <td style={brgTd}>{row.confirmation}</td>
              <td style={brgTd}>{row.entry}</td>
              <td style={brgTd}>{slMaxFor(row.type)} pip</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected !== undefined ? (
        <div style={brgResult} aria-live="polite">
          <p>
            <strong>{selected.label}:</strong> arah di {selected.major} → konfirmasi
            di {selected.confirmation} (bisa pakai trendline) → OP di{' '}
            {selected.entry} di area SND. SL maksimal {maxSl} pip.
          </p>
          <p style={brgMuted}>{selected.note}</p>
          <p style={brgMuted}>
            Langkah: (1) tentukan tipe trading; (2) SNR di TF major; (3) konfirmasi
            di TF tengah; (4) OP di TF terkecil di SND. Jangan melawan tren besar
            demi momen kecil di TF kecil — &ldquo;ujung-ujungnya loss.&rdquo;
          </p>
        </div>
      ) : null}
      <ClaimDisclaimer />
    </section>
  );
}
