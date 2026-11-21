import { useMemo, useState } from 'react';
import { useApp, type ThemeMode } from '../store/state';
import { BrgChart } from './BrgChart';
import { buildBrgExample } from './data';
import {
  LayeringCalculator,
  LotCalculator,
  MmCalculator,
  MtfGuide,
  SlTpRrCalculator,
} from './tools';
import { EntryChecklist, JournalPanel, SndWizard, SnrWizard } from './wizards';
import { ScalpingSession } from './session';

type BrgTab = 'ringkasan' | 'chart' | 'kalkulator' | 'wizard' | 'sesi';

const TABS: readonly { id: BrgTab; label: string }[] = [
  { id: 'ringkasan', label: 'Ringkasan Metode' },
  { id: 'chart', label: 'Chart Strategi' },
  { id: 'kalkulator', label: 'Kalkulator' },
  { id: 'wizard', label: 'Wizard & Checklist' },
  { id: 'sesi', label: 'Sesi & Jurnal' },
] as const;

const BRG_COMPONENTS: readonly { name: string; description: string }[] = [
  {
    name: '1. SNR / "garis sakti"',
    description:
      'Support & resistance yang "baku": memakai hitungan candle sehingga garis yang dibuat murid sama persis dengan gurunya. SNR adalah batas — harga turun sampai mana, naik sampai mana.',
  },
  {
    name: '2. Parallel channel',
    description:
      'Seperti SNR tapi miring: atas-bawah dijaga, kemiringan dijaga, "seperti lintasan balap mobil". Hasil tarik lurus dan tarik miring sama, yang penting standarisasi candle jelas.',
  },
  {
    name: '3. Multi-timeframe (MTF)',
    description:
      'TF besar menentukan arah, TF kecil untuk entry agar SL kecil. Entry langsung di H4 = floating besar karena satu candle H4 berisi banyak zigzag.',
  },
  {
    name: '4. SND (Supply & Demand)',
    description:
      'Zona tempat kebanyakan orang masuk dan keluar: "masuk pada saat orang masuk, keluar pada saat kebanyakan orang keluar". Open posisi ideal selalu di SND; tanpa SND jangan OP.',
  },
  {
    name: '5. Pola W dan M',
    description:
      'Pola pembalikan (W = naik, M = turun), dengan aturan berbeda di TF besar vs TF kecil. Market harus membuat pattern sebelum berbalik arah.',
  },
  {
    name: '6. Time trading',
    description:
      'Jam-jam market yang bagus, ditemukan dari data/backtest. Menurut klaim pembicara, dari 100 data, benar 80 dan kalah 20.',
  },
  {
    name: '7. Primary–secondary',
    description:
      'Market tidak mungkin naik terus: ada kenaikan (primary) lalu penurunan (secondary).',
  },
] as const;

const MTF_ROWS: readonly { type: string; major: string; confirmation: string; entry: string }[] = [
  { type: 'Scalping', major: 'M30', confirmation: 'M5', entry: 'M1' },
  { type: 'Intraday', major: 'H4', confirmation: 'M30', entry: 'M15' },
  { type: 'Swing', major: 'Weekly', confirmation: 'H4', entry: 'H1' },
] as const;

const SL_STANDARDS: readonly { type: string; maxSl: string; note: string }[] = [
  { type: 'Scalping', maxSl: '20 pip', note: 'Praktik scalping biasanya SL 11–15 pip.' },
  {
    type: 'Intraday',
    maxSl: '60 pip',
    note: 'Bila zona butuh SL lebih lebar, zona itu bukan zona yang bagus — jangan OP.',
  },
  {
    type: 'Swing',
    maxSl: '120 pip',
    note: 'SL ideal di atas support/resistance sebelumnya, ditambah sedikit buffer lalu dibulatkan.',
  },
] as const;

const GLOSSARY: readonly { term: string; meaning: string }[] = [
  {
    term: 'SNR / garis sakti',
    meaning:
      'Support & Resistance; batas naik/turun harga; versi Bang RAN memakai hitungan candle sehingga "baku".',
  },
  {
    term: 'SND',
    meaning:
      'Supply & Demand; zona tempat kebanyakan orang masuk/keluar; entry ideal selalu di SND. Tipe: gemuk/sedang/kurus; fresh vs tidak fresh.',
  },
  {
    term: 'Parallel channel',
    meaning:
      'Channel miring (dua garis sejajar); harga "harus" mencapai garis berikutnya; bila tertembus lanjut ke target selanjutnya.',
  },
  {
    term: 'MTF',
    meaning:
      'Multiple time frame: TF besar untuk arah, TF kecil untuk entry. Scalping M30→M5→M1; intraday H4→M30→M15; swing Weekly→H4→H1.',
  },
  { term: 'Breakout', meaning: 'Harga menembus level; valid bila candle close melewati level.' },
  {
    term: 'Retest',
    meaning:
      'Setelah breakout, harga kembali ke zona breakout sebelum melanjutkan arah — momen entry.',
  },
  {
    term: 'Pola W / M',
    meaning:
      'Double bottom (W, pembalikan naik) / double top (M, pembalikan turun); aturan berbeda di TF besar vs TF kecil.',
  },
  {
    term: 'SL (stop loss)',
    meaning: 'Batas kerugian; standar: scalping maks 20 pip, intraday 60 pip, swing 120 pip.',
  },
  {
    term: 'TP (take profit)',
    meaning: 'Target untung; minimal 2× SL (RR 1:2). TP1/TP2/TP3 = target bertingkat.',
  },
  {
    term: 'RR (risk:reward)',
    meaning: 'Perbandingan rugi vs untung; standar minimal 1:2. SL 10 pip → TP 20 pip.',
  },
] as const;

function MethodSummary(): React.JSX.Element {
  return (
    <div className="brg-grid">
      <section className="brg-card" aria-labelledby="brg-components-heading">
        <h2 id="brg-components-heading">7 Komponen Metode BRG</h2>
        <p>
          BRG adalah satu metode milik Bang RAN (nama awalnya iseng; arti lengkapnya tidak
          disebutkan di video). Prinsip yang diulang di hampir semua video: metode hanya ~40%;
          sisanya psikologi + mindset + money management.
        </p>
        <ol>
          {BRG_COMPONENTS.map((component) => (
            <li key={component.name}>
              <strong>{component.name}.</strong> {component.description}
            </li>
          ))}
        </ol>
        <p>
          Aturan yang selalu ditekankan: risiko ditentukan di awal — modal siap rugi → jarak SL →
          lot. &ldquo;Lot itu tercipta setelah kita tahu risiko.&rdquo; RR minimal 1:2. &ldquo;TP
          tidak perlu dibatasi; yang dibatasi itu kerugiannya.&rdquo; Satu mentor, satu metode,
          fokus satu pair (gold / XAU/USD). Jangan ikut sinyal, jangan FOMO, jangan pakai uang
          panas.
        </p>
      </section>

      <section className="brg-card" aria-labelledby="brg-mtf-heading">
        <h2 id="brg-mtf-heading">Pasangan Multi-Timeframe (MTF)</h2>
        <p>
          Tentukan TF besar dulu baru TF kecil — jangan kebalik. &ldquo;Tren itu tidak mungkin
          dimulai dari 1 menit ke 4 jam.&rdquo;
        </p>
        <div className="brg-table-wrap">
          <table className="brg-table">
            <thead>
              <tr>
                <th scope="col">Tipe</th>
                <th scope="col">TF major (arah)</th>
                <th scope="col">TF konfirmasi</th>
                <th scope="col">TF entry (OP)</th>
              </tr>
            </thead>
            <tbody>
              {MTF_ROWS.map((row) => (
                <tr key={row.type}>
                  <th scope="row">{row.type}</th>
                  <td>{row.major}</td>
                  <td>{row.confirmation}</td>
                  <td>{row.entry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Untuk scalping, dari M30 langsung ke M5 (M15 dilewati karena &ldquo;perbandingannya cuma
          satu candle&rdquo;). Jangan melawan tren besar demi momen kecil di TF kecil —
          &ldquo;ujung-ujungnya loss.&rdquo;
        </p>
      </section>

      <section className="brg-card" aria-labelledby="brg-sl-heading">
        <h2 id="brg-sl-heading">Standar Stop Loss</h2>
        <div className="brg-table-wrap">
          <table className="brg-table">
            <thead>
              <tr>
                <th scope="col">Tipe trading</th>
                <th scope="col">SL maksimal</th>
                <th scope="col">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {SL_STANDARDS.map((row) => (
                <tr key={row.type}>
                  <th scope="row">{row.type}</th>
                  <td>{row.maxSl}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Prinsip urutan: risiko dulu, baru SL, baru lot. &ldquo;Stop loss itu tercipta setelah
          kalian tahu risiko kalian, jangan kebalik.&rdquo; Letak SL: di support terdekat dari zona
          SND (buy) / di atas resistance terdekat (sell), ditambah sedikit jarak dan dibulatkan
          (mis. 18 pip → 20 pip; 11 pip → 12 pip).
        </p>
      </section>

      <section className="brg-card" aria-labelledby="brg-glossary-heading">
        <h2 id="brg-glossary-heading">Glosarium Singkat</h2>
        <dl>
          {GLOSSARY.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default function BangranFxPage(): React.JSX.Element {
  const { state, setTheme } = useApp();
  const [tab, setTab] = useState<BrgTab>('ringkasan');
  // Skenario contoh (data sintetis deterministik) untuk tab Chart Strategi.
  const scenario = useMemo(() => buildBrgExample(), []);

  return (
    <div className="brg-page">
      <header className="brg-header">
        <div>
          <h1>Strategi BRG — BangranFX</h1>
          <p className="brg-subtitle">
            Metode Bang RAN (RAN Trade Academy) untuk gold / XAU/USD: SNR &ldquo;garis sakti&rdquo;,
            parallel channel, multi-timeframe, SND, dan pola W/M — diringkas dari 91 video channel
            @bangranfx (6 Jan 2023 – 31 Agu 2026).
          </p>
        </div>
        <label className="brg-field brg-theme-field">
          <span>Tema</span>
          <select
            value={state.theme}
            onChange={(event) => {
              setTheme(event.target.value as ThemeMode);
            }}
            aria-label="Tema tampilan"
          >
            <option value="system">Sistem</option>
            <option value="light">Terang</option>
            <option value="dark">Gelap</option>
          </select>
        </label>
      </header>

      <aside className="brg-warning" role="note" aria-label="Catatan kejujuran">
        <strong>Catatan kejujuran.</strong> Semua klaim profit, angka challenge (mis. Rp1,5 jt →
        Rp109 jt), dan win rate yang muncul di video adalah{' '}
        <strong>klaim pembicara, bukan fakta terverifikasi</strong> secara independen. Metode ini
        belum dibacktest independen di sini — backtest dulu sebelum percaya metode apa pun
        (&ldquo;bisa jadi Abang bohong sama kalian&rdquo; — percaya pada data, bukan pada orangnya).
        Halaman ini hanya untuk belajar, bukan nasihat keuangan.
        <br />
        <strong>Kontradiksi di dalam channel, ditampilkan apa adanya:</strong> video No. 71/76
        memakai risiko <strong>1% per trade</strong>, sedangkan No. 79 (compounding 20 step, $20 →
        $2.926) memakai risiko <strong>30% per step</strong> — dua jalur untuk situasi berbeda
        (modal besar vs modal sangat kecil), bukan satu aturan. Demikian pula RR: trading normal
        memakai <strong>RR 1:2</strong>, sedangkan challenge memakai <strong>RR 1:1</strong>{' '}
        (floating dan profit harus imbang). Penjelasan pola M di TF kecil juga tidak sepenuhnya
        konsisten antar video (No. 34 vs No. 35).
      </aside>

      <div className="brg-tabs" role="tablist" aria-label="Bagian Strategi BRG">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`brg-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`brg-panel-${entry.id}`}
            className="brg-tab-button"
            onClick={() => {
              setTab(entry.id);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`brg-panel-${tab}`}
        aria-labelledby={`brg-tab-${tab}`}
        className="brg-panel"
      >
        {tab === 'ringkasan' ? <MethodSummary /> : null}
        {tab === 'chart' ? (
          <BrgChart
            candles={scenario.candles}
            snrLevels={scenario.snrLevels}
            sndZones={scenario.sndZones}
            channel={scenario.channel}
            ema={scenario.ema}
            patterns={scenario.patterns}
            presetName={scenario.preset.name}
            entrySlTp={{
              entry: scenario.preset.entry,
              sl: scenario.preset.sl,
              tp: scenario.preset.tp,
              direction: scenario.preset.direction,
            }}
          />
        ) : null}
        {tab === 'kalkulator' ? (
          <div className="brg-grid">
            <LotCalculator />
            <SlTpRrCalculator />
            <LayeringCalculator />
            <MmCalculator />
            <MtfGuide />
          </div>
        ) : null}
        {tab === 'wizard' ? (
          <div className="brg-grid">
            <SnrWizard />
            <SndWizard />
            <EntryChecklist />
            <JournalPanel />
          </div>
        ) : null}
        {tab === 'sesi' ? <ScalpingSession /> : null}
      </div>
    </div>
  );
}
