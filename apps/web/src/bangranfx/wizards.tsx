/**
 * Wizard & checklist Metode BRG (BangranFX) — Modul B.
 *
 * Sumber: ~/workspace/bangranfx/research/synthesis.md Bab 4 (SNR), Bab 5 (SND),
 * Bab 8 (entry breakout + retest), Bab 17 (jurnal).
 * Semua klaim profit di video adalah KLAIM PEMBICARA, bukan fakta terverifikasi.
 *
 * Preset contoh memakai tipe dari ../bangranfx/data.ts (Candle, SndZone,
 * SnrLevel) — wizard menerima level/zona awal opsional dari preset tersebut;
 * tanpa preset pun wizard tetap bisa dipakai penuh (semua langkah diisi manual).
 */
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Candle, SndZone, SnrLevel } from './data';
import {
  ClaimDisclaimer,
  NumberField,
  SelectField,
  brgButton,
  brgButtonSecondary,
  brgCard,
  brgField,
  brgInput,
  brgMuted,
  brgNote,
  brgResult,
  brgTable,
  brgTd,
  brgTh,
  brgWarning,
  fmt,
  safeRiskReward,
} from './tools';
import type { BrgDirection } from './tools';

function WizardShell({
  title,
  headingId,
  children,
}: {
  title: string;
  headingId: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <section style={brgCard} aria-labelledby={headingId}>
      <h2 id={headingId} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StepNav({
  step,
  total,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}): ReactElement {
  return (
    <div>
      <p style={brgMuted}>
        Langkah {step} dari {total}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={brgButtonSecondary}
          onClick={onBack}
          disabled={step <= 1}
        >
          Kembali
        </button>
        <button
          type="button"
          style={brgButton}
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function PresetNote({ label, value }: { label: string; value: unknown }): ReactElement {
  return (
    <details style={{ marginBottom: '0.75rem' }}>
      <summary>{label}</summary>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '0.5rem',
          fontSize: '0.8rem',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

/* ---------- SnrWizard ---------- */

/**
 * Bab 4: menentukan SNR ("garis sakti") dalam 5 langkah.
 * 1) pilih TF -> 2) cari swing -> 3) tarik garis dari body candle ->
 * 4) uji sentuhan -> 5) fresh / teruji.
 */
export function SnrWizard({
  initialLevel,
}: {
  initialLevel?: SnrLevel;
}): ReactElement {
  const uid = useId();
  const [step, setStep] = useState(1);
  const [tf, setTf] = useState('H4');
  const [swingsFound, setSwingsFound] = useState(false);
  const [lineDrawn, setLineDrawn] = useState(false);
  const [touches, setTouches] = useState(2);
  const [freshness, setFreshness] = useState<'fresh' | 'teruji'>('fresh');

  const nextDisabled =
    (step === 2 && !swingsFound) || (step === 3 && !lineDrawn);
  const done = step > 5;

  return (
    <WizardShell title="Wizard SNR — Menentukan Garis Sakti" headingId={`${uid}-snr-heading`}>
      <p style={brgMuted}>
        SNR adalah batas: harga turun sampai mana, naik sampai mana. Garis versi Bang
        RAN memakai hitungan candle sehingga &ldquo;baku&rdquo; — garis yang dibuat
        murid sama persis dengan gurunya.
      </p>
      {initialLevel !== undefined ? (
        <PresetNote label="Preset level SNR dari data.ts" value={initialLevel} />
      ) : null}
      {!done ? (
        <div aria-live="polite">
          {step === 1 ? (
            <div>
              <h3>Langkah 1 — Pilih timeframe</h3>
              <SelectField
                id={`${uid}-tf`}
                label="Timeframe SNR"
                value={tf}
                onChange={setTf}
                options={[
                  { value: 'H4', label: 'H4 — intraday gold' },
                  { value: 'Weekly', label: 'Weekly — swing, SNR terkuat' },
                  { value: 'M30', label: 'M30 — scalping' },
                ]}
                hint="Untuk intraday gold pakai H4; untuk swing pakai weekly."
              />
            </div>
          ) : null}
          {step === 2 ? (
            <div>
              <h3>Langkah 2 — Cari swing</h3>
              <p>
                Cari titik tertinggi / terendah yang selevel di chart {tf}. Dua swing
                yang berdekatan membuat level lebih kuat (support berlapis).
              </p>
              <div style={brgField}>
                <label htmlFor={`${uid}-swings`}>
                  <input
                    id={`${uid}-swings`}
                    type="checkbox"
                    checked={swingsFound}
                    onChange={(event) => {
                      setSwingsFound(event.target.checked);
                    }}
                  />{' '}
                  Sudah menemukan minimal 2 swing selevel
                </label>
              </div>
            </div>
          ) : null}
          {step === 3 ? (
            <div>
              <h3>Langkah 3 — Tarik garis dari body candle</h3>
              <p>
                Tarik garis horizontal dari body candle di titik tertinggi / terendah
                (bukan dari sumbu). Gunakan magnet agar rapi.
              </p>
              <div style={brgField}>
                <label htmlFor={`${uid}-line`}>
                  <input
                    id={`${uid}-line`}
                    type="checkbox"
                    checked={lineDrawn}
                    onChange={(event) => {
                      setLineDrawn(event.target.checked);
                    }}
                  />{' '}
                  Garis sudah ditarik dari body candle
                </label>
              </div>
            </div>
          ) : null}
          {step === 4 ? (
            <div>
              <h3>Langkah 4 — Uji sentuhan</h3>
              <p>
                Hitung berapa kali harga menyentuh level lalu memantul. Bila level
                ditembus, fungsinya berubah: resistance become support (dan sebaliknya).
              </p>
              <NumberField
                id={`${uid}-touches`}
                label="Jumlah sentuhan yang memantul"
                value={touches}
                onChange={(value) => {
                  setTouches(Math.max(0, Math.round(value)));
                }}
                min={0}
                max={20}
                step={1}
              />
            </div>
          ) : null}
          {step === 5 ? (
            <div>
              <h3>Langkah 5 — Fresh atau teruji?</h3>
              <p>
                Level yang sudah sering disentuh makin lemah; level yang belum pernah
                disentuh (fresh) lebih kuat. SND yang berada tepat di SNR lebih kuat.
              </p>
              <div style={brgField}>
                <span id={`${uid}-fresh-label`}>Status level</span>
                <div role="radiogroup" aria-labelledby={`${uid}-fresh-label`}>
                  <label htmlFor={`${uid}-fresh`} style={{ display: 'block' }}>
                    <input
                      id={`${uid}-fresh`}
                      type="radio"
                      name={`${uid}-freshness`}
                      checked={freshness === 'fresh'}
                      onChange={() => {
                        setFreshness('fresh');
                      }}
                    />{' '}
                    Fresh — belum pernah disentuh
                  </label>
                  <label htmlFor={`${uid}-tested`} style={{ display: 'block' }}>
                    <input
                      id={`${uid}-tested`}
                      type="radio"
                      name={`${uid}-freshness`}
                      checked={freshness === 'teruji'}
                      onChange={() => {
                        setFreshness('teruji');
                      }}
                    />{' '}
                    Teruji — sudah disentuh dan memantul
                  </label>
                </div>
              </div>
            </div>
          ) : null}
          <StepNav
            step={step}
            total={5}
            onBack={() => {
              setStep((current) => Math.max(1, current - 1));
            }}
            onNext={() => {
              setStep((current) => current + 1);
            }}
            nextDisabled={nextDisabled}
            nextLabel={step === 5 ? 'Lihat ringkasan' : 'Lanjut'}
          />
        </div>
      ) : (
        <div style={brgResult} aria-live="polite">
          <h3>Ringkasan SNR Anda</h3>
          <p>
            Timeframe: <strong>{tf}</strong> — garis dari body candle,{' '}
            <strong>{touches}× sentuhan</strong> yang memantul, status{' '}
            <strong>{freshness === 'fresh' ? 'fresh' : 'teruji'}</strong>.
          </p>
          <p>
            {touches >= 2 && freshness === 'fresh'
              ? 'Level ini kuat: dua swing selevel dan masih fresh. Ingat — open posisi selalu di SND, bukan langsung di SNR.'
              : touches >= 2
                ? 'Level teruji dan memantul — bisa dipakai, tetapi waspada: makin sering disentuh, makin lemah. Open posisi tetap di SND, bukan langsung di SNR.'
                : 'Level masih lemah (kurang dari 2 sentuhan). Cari konfirmasi tambahan atau level lain.'}
          </p>
          <p style={brgMuted}>
            Bila harga menembus level ini, lanjut ke level berikutnya; area penembusan
            menjadi acuan entry (resistance become support).
          </p>
          <button
            type="button"
            style={brgButtonSecondary}
            onClick={() => {
              setStep(1);
            }}
          >
            Ulangi wizard
          </button>
        </div>
      )}
      <ClaimDisclaimer />
    </WizardShell>
  );
}

/* ---------- SndWizard ---------- */

/**
 * Bab 5: menentukan SND (Supply & Demand).
 * Pola buy hijau-merah-hijau; pola sell merah-hijau-merah.
 * Ketebalan gemuk / sedang / kurus; fresh vs sudah tersentuh.
 */
export function SndWizard({
  initialZone,
}: {
  initialZone?: SndZone;
}): ReactElement {
  const uid = useId();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<BrgDirection>('buy');
  const [thickness, setThickness] = useState<'gemuk' | 'sedang' | 'kurus'>('sedang');
  const [fresh, setFresh] = useState(true);
  const [doubleZone, setDoubleZone] = useState(false);
  const [bigTfRespected, setBigTfRespected] = useState(false);

  const done = step > 4;
  const pattern =
    direction === 'buy' ? 'hijau – merah – hijau' : 'merah – hijau – merah';

  return (
    <WizardShell title="Wizard SND — Menentukan Zona Entry" headingId={`${uid}-snd-heading`}>
      <p style={brgMuted}>
        SND adalah zona tempat kebanyakan orang masuk dan keluar. Open posisi ideal
        selalu di SND; tanpa SND jangan OP.
      </p>
      {initialZone !== undefined ? (
        <PresetNote label="Preset zona SND dari data.ts" value={initialZone} />
      ) : null}
      {!done ? (
        <div aria-live="polite">
          {step === 1 ? (
            <div>
              <h3>Langkah 1 — Kenali polanya</h3>
              <SelectField
                id={`${uid}-direction`}
                label="Arah zona"
                value={direction}
                onChange={(value) => {
                  setDirection(value as BrgDirection);
                }}
                options={[
                  { value: 'buy', label: 'Buy — pola hijau-merah-hijau' },
                  { value: 'sell', label: 'Sell — pola merah-hijau-merah' },
                ]}
                hint="SND sell muncul setelah harga gagal menembus resistance (dua kali gagal lalu drop)."
              />
              <p>
                Pola yang dicari: <strong>{pattern}</strong>.
              </p>
            </div>
          ) : null}
          {step === 2 ? (
            <div>
              <h3>Langkah 2 — Nilai ketebalannya</h3>
              <SelectField
                id={`${uid}-thickness`}
                label="Ketebalan zona"
                value={thickness}
                onChange={(value) => {
                  setThickness(value as 'gemuk' | 'sedang' | 'kurus');
                }}
                options={[
                  { value: 'gemuk', label: 'Gemuk — koreksi lebih dalam' },
                  { value: 'sedang', label: 'Sedang' },
                  { value: 'kurus', label: 'Kurus — masih bisa ditembus' },
                ]}
                hint="Ketebalan zona memengaruhi seberapa dalam koreksi harga."
              />
            </div>
          ) : null}
          {step === 3 ? (
            <div>
              <h3>Langkah 3 — Fresh atau sudah tersentuh?</h3>
              <p>
                SND yang sudah pernah tersentuh tidak fresh lagi — harga akan mengejar
                SND berikutnya yang belum tersentuh. Jangan masuk ke SND yang sudah
                tersentuh / selesai.
              </p>
              <div style={brgField}>
                <span id={`${uid}-fresh-label`}>Status zona</span>
                <div role="radiogroup" aria-labelledby={`${uid}-fresh-label`}>
                  <label htmlFor={`${uid}-fresh`} style={{ display: 'block' }}>
                    <input
                      id={`${uid}-fresh`}
                      type="radio"
                      name={`${uid}-freshness`}
                      checked={fresh}
                      onChange={() => {
                        setFresh(true);
                      }}
                    />{' '}
                    Fresh — belum pernah tersentuh (kuat)
                  </label>
                  <label htmlFor={`${uid}-touched`} style={{ display: 'block' }}>
                    <input
                      id={`${uid}-touched`}
                      type="radio"
                      name={`${uid}-freshness`}
                      checked={!fresh}
                      onChange={() => {
                        setFresh(false);
                      }}
                    />{' '}
                    Sudah tersentuh (lemah)
                  </label>
                </div>
              </div>
            </div>
          ) : null}
          {step === 4 ? (
            <div>
              <h3>Langkah 4 — Cek TF besar & SND ganda</h3>
              <p>
                SND di TF besar (M30 ke atas) tidak boleh ditembus: minimal harga naik
                dulu sebelum drop. SND ganda — muncul di dua TF sekaligus (mis. M5 dan
                M1) — lebih kuat.
              </p>
              <div style={brgField}>
                <label htmlFor={`${uid}-bigtf`} style={{ display: 'block' }}>
                  <input
                    id={`${uid}-bigtf`}
                    type="checkbox"
                    checked={bigTfRespected}
                    onChange={(event) => {
                      setBigTfRespected(event.target.checked);
                    }}
                  />{' '}
                  Zona menghormati SND TF besar (tidak menembusnya)
                </label>
                <label htmlFor={`${uid}-double`} style={{ display: 'block' }}>
                  <input
                    id={`${uid}-double`}
                    type="checkbox"
                    checked={doubleZone}
                    onChange={(event) => {
                      setDoubleZone(event.target.checked);
                    }}
                  />{' '}
                  SND ganda — muncul juga di TF lain
                </label>
              </div>
            </div>
          ) : null}
          <StepNav
            step={step}
            total={4}
            onBack={() => {
              setStep((current) => Math.max(1, current - 1));
            }}
            onNext={() => {
              setStep((current) => current + 1);
            }}
            nextDisabled={false}
            nextLabel={step === 4 ? 'Lihat penilaian zona' : 'Lanjut'}
          />
        </div>
      ) : (
        <div style={brgResult} aria-live="polite">
          <h3>Penilaian Zona SND</h3>
          <p>
            Zona {direction === 'buy' ? 'buy' : 'sell'} ({pattern}), ketebalan{' '}
            <strong>{thickness}</strong>,{' '}
            <strong>{fresh ? 'fresh' : 'sudah tersentuh'}</strong>
            {doubleZone ? ', SND ganda' : ''}.
          </p>
          {!fresh ? (
            <div style={brgWarning} role="alert">
              <strong>Jangan entry di zona ini.</strong> Zona sudah tersentuh — harga
              akan mengejar SND berikutnya yang belum tersentuh.
            </div>
          ) : (
            <p>
              {thickness === 'kurus'
                ? 'Zona fresh tetapi kurus — masih bisa ditembus; pakai SL sesuai standar dan jangan memaksakan lot besar.'
                : 'Zona fresh dan layak ditunggu. Tunggu harga sampai ke zona, konfirmasi candle, baru entry — jangan entry di tengah jalan.'}
            </p>
          )}
          <p style={brgMuted}>
            Pengalaman yang disebut di video: dari SND pertama, harga biasanya running
            sekitar 100 pip (intraday) — itu klaim pembicara, bukan jaminan.
          </p>
          <button
            type="button"
            style={brgButtonSecondary}
            onClick={() => {
              setStep(1);
            }}
          >
            Ulangi wizard
          </button>
        </div>
      )}
      <ClaimDisclaimer />
    </WizardShell>
  );
}

/* ---------- EntryChecklist ---------- */

/**
 * Bab 8: urutan entry standar — breakout + close -> retest -> konfirmasi candle
 * -> entry di SND -> SL/TP terpasang. Ringkasan setup hanya tampil bila semua
 * langkah dicentang.
 */
const ENTRY_STEPS: readonly { id: string; label: string; detail: string }[] = [
  {
    id: 'trend',
    label: 'SNR / tren di TF major sudah ditentukan',
    detail: 'Arah besar jelas; jangan melawan tren.',
  },
  {
    id: 'breakout',
    label: 'Breakout + close candle melewati level',
    detail: 'Break belum valid sebelum candle close melewati level.',
  },
  {
    id: 'retest',
    label: 'Harga kembali (retest) ke zona breakout / SND',
    detail: '"Kalau dia sudah breakout, dia harus balik ke zona tersebut."',
  },
  {
    id: 'confirm',
    label: 'Konfirmasi candle (engulfing / full body) atau pola M/W',
    detail: 'Tunggu candle close sebagai konfirmasi pembalikan.',
  },
  {
    id: 'snd',
    label: 'Entry di SND TF terkecil (bukan di tengah jalan)',
    detail: 'Bila tidak ada area SND, jangan open posisi.',
  },
  {
    id: 'sltp',
    label: 'SL dan TP sudah terpasang (RR minimal 1:2)',
    detail: 'SL di bawah support / di atas resistance terdekat; TP minimal 2× SL.',
  },
] as const;

export function EntryChecklist({
  konfirmasiCandles,
}: {
  konfirmasiCandles?: readonly Candle[];
}): ReactElement {
  const uid = useId();
  const [checked, setChecked] = useState<readonly string[]>([]);
  const [direction, setDirection] = useState<BrgDirection>('buy');
  const [entry, setEntry] = useState(1956);
  const [sl, setSl] = useState(1954);
  const [tp, setTp] = useState(1960);

  const allChecked = ENTRY_STEPS.every((step) => checked.includes(step.id));
  const rr = useMemo(
    () => safeRiskReward(entry, sl, tp),
    [entry, sl, tp],
  );

  return (
    <WizardShell title="Checklist Entry — Breakout + Retest" headingId={`${uid}-entry-heading`}>
      <p style={brgMuted}>
        Entry setelah breakout lebih aman (SL kecil) daripada entry prematur di
        support (contoh SL 46 pip). Centang semua langkah untuk melihat ringkasan
        setup.
      </p>
      {konfirmasiCandles !== undefined ? (
        <p style={brgNote}>
          Candle konfirmasi dari chart: {konfirmasiCandles.length} candle.
        </p>
      ) : null}
      <fieldset style={{ border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
        <legend>Langkah entry</legend>
        {ENTRY_STEPS.map((step) => (
          <div key={step.id} style={{ marginBottom: '0.5rem' }}>
            <label htmlFor={`${uid}-${step.id}`}>
              <input
                id={`${uid}-${step.id}`}
                type="checkbox"
                checked={checked.includes(step.id)}
                onChange={(event) => {
                  setChecked((current) =>
                    event.target.checked
                      ? [...current, step.id]
                      : current.filter((id) => id !== step.id),
                  );
                }}
              />{' '}
              <strong>{step.label}</strong>
              <br />
              <small style={brgMuted}>{step.detail}</small>
            </label>
          </div>
        ))}
      </fieldset>
      {allChecked ? (
        <div style={brgResult} aria-live="polite">
          <h3>Ringkasan setup — semua langkah terpenuhi</h3>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            }}
          >
            <SelectField
              id={`${uid}-direction`}
              label="Arah"
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
              label="Entry"
              value={entry}
              onChange={setEntry}
              min={0}
              step={0.5}
            />
            <NumberField
              id={`${uid}-sl`}
              label="Stop loss"
              value={sl}
              onChange={setSl}
              min={0}
              step={0.5}
            />
            <NumberField
              id={`${uid}-tp`}
              label="Take profit"
              value={tp}
              onChange={setTp}
              min={0}
              step={0.5}
            />
          </div>
          <p>
            {rr === null ? (
              'Isi entry, SL, dan TP yang berbeda untuk menghitung RR.'
            ) : (
              <>
                Risiko {fmt(rr.riskPips, 0)} pip, reward {fmt(rr.rewardPips, 0)}{' '}
                pip, RR 1:{fmt(rr.ratio, 2)}.
              </>
            )}
          </p>
          {rr?.meetsMinimum === false ? (
            <div style={brgWarning} role="alert">
              <strong>RR di bawah 1:2.</strong> Standar minimal metode ini adalah
              1:2 — pertimbangkan TP lebih jauh atau jangan entry.
            </div>
          ) : null}
          {rr?.meetsMinimum === true ? (
            <p>
              RR memenuhi standar minimal 1:2. Setelah entry: bila running 10–15 pip,
              pindahkan SL ke BEP; jangan ubah plan di tengah jalan saat floating.
            </p>
          ) : null}
        </div>
      ) : (
        <p style={brgNote}>
          {ENTRY_STEPS.length - checked.length} langkah lagi sebelum ringkasan setup
          tampil. Sabar menunggu harga sampai ke zona — kebanyakan orang tidak sabar
          lalu langsung OP.
        </p>
      )}
      <ClaimDisclaimer />
    </WizardShell>
  );
}

/* ---------- JournalPanel ---------- */

/** Satu baris jurnal (Bab 17: jurnal sederhana untuk backtest & evaluasi). */
export interface BrgJournalEntry {
  id: string;
  tanggal: string;
  pair: string;
  arah: BrgDirection;
  entry: number;
  sl: number;
  tp: number;
  hasil: string;
  catatan: string;
}

export const BRG_JOURNAL_KEY = 'trade:brg-journal:v1';

function loadJournal(): BrgJournalEntry[] {
  try {
    const raw = window.localStorage.getItem(BRG_JOURNAL_KEY);
    if (raw === null || raw === '') return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is BrgJournalEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { tanggal?: unknown }).tanggal === 'string',
    );
  } catch {
    return [];
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `brg-${String(Date.now())}-${String(Math.floor(Math.random() * 1_000_000))}`;
}

export function JournalPanel(): ReactElement {
  const uid = useId();
  const [entries, setEntries] = useState<BrgJournalEntry[]>(() => loadJournal());
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [pair, setPair] = useState('XAU/USD');
  const [arah, setArah] = useState<BrgDirection>('buy');
  const [entry, setEntry] = useState(1956);
  const [sl, setSl] = useState(1954);
  const [tp, setTp] = useState(1960);
  const [hasil, setHasil] = useState('');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(BRG_JOURNAL_KEY, JSON.stringify(entries));
    } catch {
      // localStorage penuh / tidak tersedia: jurnal hanya bertahan di sesi ini.
    }
  }, [entries]);

  const addEntry = (): void => {
    const next: BrgJournalEntry = {
      id: newId(),
      tanggal,
      pair: pair.trim() === '' ? 'XAU/USD' : pair.trim(),
      arah,
      entry,
      sl,
      tp,
      hasil: hasil.trim(),
      catatan: catatan.trim(),
    };
    setEntries((current) => [next, ...current]);
    setHasil('');
    setCatatan('');
  };

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'jurnal-brg.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <WizardShell title="Jurnal Trading" headingId={`${uid}-journal-heading`}>
      <p style={brgMuted}>
        Catat semua trade, sederhanakan, dan backtest — percaya pada data, bukan pada
        orangnya. Jurnal tersimpan di perangkat ini (localStorage, kunci{' '}
        <code>{BRG_JOURNAL_KEY}</code>).
      </p>
      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        <div style={brgField}>
          <label htmlFor={`${uid}-tanggal`}>Tanggal</label>
          <input
            id={`${uid}-tanggal`}
            type="date"
            style={brgInput}
            value={tanggal}
            onChange={(event) => {
              setTanggal(event.target.value);
            }}
          />
        </div>
        <div style={brgField}>
          <label htmlFor={`${uid}-pair`}>Pair</label>
          <input
            id={`${uid}-pair`}
            type="text"
            style={brgInput}
            value={pair}
            onChange={(event) => {
              setPair(event.target.value);
            }}
          />
        </div>
        <SelectField
          id={`${uid}-arah`}
          label="Arah"
          value={arah}
          onChange={(value) => {
            setArah(value as BrgDirection);
          }}
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
          ]}
        />
        <NumberField
          id={`${uid}-entry`}
          label="Entry"
          value={entry}
          onChange={setEntry}
          min={0}
          step={0.5}
        />
        <NumberField
          id={`${uid}-sl`}
          label="Stop loss"
          value={sl}
          onChange={setSl}
          min={0}
          step={0.5}
        />
        <NumberField
          id={`${uid}-tp`}
          label="Take profit"
          value={tp}
          onChange={setTp}
          min={0}
          step={0.5}
        />
        <div style={brgField}>
          <label htmlFor={`${uid}-hasil`}>Hasil</label>
          <input
            id={`${uid}-hasil`}
            type="text"
            style={brgInput}
            value={hasil}
            placeholder="mis. +20 pip / -10 pip / BEP"
            onChange={(event) => {
              setHasil(event.target.value);
            }}
          />
        </div>
        <div style={brgField}>
          <label htmlFor={`${uid}-catatan`}>Catatan</label>
          <input
            id={`${uid}-catatan`}
            type="text"
            style={brgInput}
            value={catatan}
            placeholder="mis. entry di SND M1, retest bersih"
            onChange={(event) => {
              setCatatan(event.target.value);
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" style={brgButton} onClick={addEntry}>
          Simpan ke jurnal
        </button>
        <button
          type="button"
          style={brgButtonSecondary}
          onClick={exportJson}
          disabled={entries.length === 0}
        >
          Ekspor JSON ({entries.length})
        </button>
      </div>
      {entries.length === 0 ? (
        <p style={brgNote}>Belum ada entri jurnal.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
          <table style={brgTable}>
            <thead>
              <tr>
                <th scope="col" style={brgTh}>
                  Tanggal
                </th>
                <th scope="col" style={brgTh}>
                  Pair
                </th>
                <th scope="col" style={brgTh}>
                  Arah
                </th>
                <th scope="col" style={brgTh}>
                  Entry
                </th>
                <th scope="col" style={brgTh}>
                  SL
                </th>
                <th scope="col" style={brgTh}>
                  TP
                </th>
                <th scope="col" style={brgTh}>
                  Hasil
                </th>
                <th scope="col" style={brgTh}>
                  Catatan
                </th>
                <th scope="col" style={brgTh}>
                  <span className="visually-hidden">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((item) => (
                <tr key={item.id}>
                  <td style={brgTd}>{item.tanggal}</td>
                  <td style={brgTd}>{item.pair}</td>
                  <td style={brgTd}>{item.arah}</td>
                  <td style={brgTd}>{fmt(item.entry, 2)}</td>
                  <td style={brgTd}>{fmt(item.sl, 2)}</td>
                  <td style={brgTd}>{fmt(item.tp, 2)}</td>
                  <td style={brgTd}>{item.hasil}</td>
                  <td style={brgTd}>{item.catatan}</td>
                  <td style={brgTd}>
                    <button
                      type="button"
                      style={{ ...brgButtonSecondary, minHeight: 44 }}
                      aria-label={`Hapus entri ${item.tanggal} ${item.pair}`}
                      onClick={() => {
                        setEntries((current) =>
                          current.filter((row) => row.id !== item.id),
                        );
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ClaimDisclaimer />
    </WizardShell>
  );
}
