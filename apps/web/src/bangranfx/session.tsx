/**
 * Sesi scalping & tracker challenge Metode BRG (BangranFX) — Modul B.
 *
 * Sumber: ~/workspace/bangranfx/research/synthesis.md Bab 13 (alur satu sesi
 * scalping) dan Bab 14 (challenge & grow akun kecil).
 * Semua angka challenge di video adalah KLAIM PEMBICARA, bukan fakta
 * terverifikasi independen — peringatan itu ditampilkan menonjol di UI.
 */
import { useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  ClaimDisclaimer,
  NumberField,
  SelectField,
  brgButton,
  brgButtonSecondary,
  brgCard,
  brgField,
  brgMuted,
  brgNote,
  brgResult,
  brgTable,
  brgTd,
  brgTh,
  brgWarning,
  fmt,
} from './tools';
import type { BrgDirection } from './tools';

/** Langkah alur satu sesi scalping (Bab 13). */
const SESSION_STEPS: readonly { id: string; label: string; detail: string }[] = [
  {
    id: 'tren',
    label: 'Pagi: tentukan tren harian',
    detail: 'TF besar (H4/weekly) menentukan arah. Info tren dibagikan ke grup sekitar jam 11.00–11.30 di contoh video.',
  },
  {
    id: 'zona',
    label: 'Tentukan zona intraday',
    detail: 'SND di M15. Dalam satu hari SND biasanya muncul 1–2 kali; yang "running" jauh biasanya hanya satu.',
  },
  {
    id: 'entry',
    label: 'Masuk TF kecil (M5/M1): tunggu break, lalu entry di SND',
    detail: 'Tunggu harga break level tertentu, lalu ada zigzag — harga naik dulu (retest) baru drop (untuk sell).',
  },
  {
    id: 'layering',
    label: 'Layering saat harga running',
    detail: 'Tambah layer hanya saat harga sudah running. Maksimal 5 layer dalam satu zone.',
  },
  {
    id: 'close',
    label: 'Close sebagian saat profit',
    detail: 'Tutup sebagian untuk menambah balance/equity penahan floating. Bila TP1 kena, SL ke BEP.',
  },
  {
    id: 'cukup',
    label: 'Tahu batas cukup — berhenti hari itu',
    detail: 'Bila profit running mulai berkurang (market melemah / "butuh napas"), close dan berhenti. Jangan serakah menahan posisi terlalu lama.',
  },
] as const;

interface ChallengeLog {
  id: string;
  part: number;
  perubahan: number;
  saldoSetelah: number;
  catatan: string;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `brg-ch-${String(Date.now())}-${String(Math.floor(Math.random() * 1_000_000))}`;
}

export function ScalpingSession(): ReactElement {
  const uid = useId();
  const [doneSteps, setDoneSteps] = useState<readonly string[]>([]);
  const [arahPagi, setArahPagi] = useState<BrgDirection>('sell');
  const [putarHaluan, setPutarHaluan] = useState(false);

  const [modalAwal, setModalAwal] = useState(1_000_000);
  const [target, setTarget] = useState(10_000_000);
  const [saldo, setSaldo] = useState(1_000_000);
  const [part, setPart] = useState(1);
  const [perubahan, setPerubahan] = useState(0);
  const [catatan, setCatatan] = useState('');
  const [log, setLog] = useState<readonly ChallengeLog[]>([]);

  const progress = useMemo(() => {
    if (target <= modalAwal) return 0;
    return Math.min(100, Math.max(0, ((saldo - modalAwal) / (target - modalAwal)) * 100));
  }, [saldo, modalAwal, target]);
  const targetTercapai = saldo >= target;
  const nearTarget = !targetTercapai && saldo >= modalAwal + (target - modalAwal) * 0.9;

  const catatHasil = (): void => {
    const nextSaldo = saldo + perubahan;
    const entryLog: ChallengeLog = {
      id: newId(),
      part,
      perubahan,
      saldoSetelah: nextSaldo,
      catatan: catatan.trim(),
    };
    setLog((current) => [entryLog, ...current]);
    setSaldo(nextSaldo);
    setPerubahan(0);
    setCatatan('');
  };

  const naikPart = (): void => {
    setPart((current) => current + 1);
  };

  return (
    <section style={brgCard} aria-labelledby={`${uid}-session-heading`}>
      <h2 id={`${uid}-session-heading`} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
        Sesi Scalping &amp; Tracker Challenge
      </h2>

      <div style={brgWarning} role="alert">
        <strong>PERINGATAN — lot besar / &ldquo;barbar&rdquo; di video JANGAN DITIRU.</strong>{' '}
        Di video challenge, lot yang dipakai besar karena dananya adalah dana profit
        dan pembicara sudah punya jam terbang tinggi. Peringatan yang diulang di
        setiap video challenge: sesuaikan lot dengan kesiapan / risiko Anda sendiri;
        challenge bukan untuk pemula. Trading normal memakai lot dari risiko (lihat
        Kalkulator Lot), bukan lot besar.
      </div>

      <h3>Simulasi sesi scalping hari ini</h3>
      <p style={brgMuted}>
        Alur yang berulang di puluhan video live trade. Centang langkah yang sudah
        dilakukan — urutannya penting.
      </p>
      <div style={brgField}>
        <SelectField
          id={`${uid}-arah`}
          label="Tren pagi (TF besar)"
          value={arahPagi}
          onChange={(value) => {
            setArahPagi(value as BrgDirection);
          }}
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
          ]}
          hint="Kalau arah tren bilang sell ya sell saja, jangan dicounter."
        />
      </div>
      <fieldset style={{ border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
        <legend>Langkah sesi</legend>
        {SESSION_STEPS.map((step, index) => (
          <div key={step.id} style={{ marginBottom: '0.5rem' }}>
            <label htmlFor={`${uid}-${step.id}`}>
              <input
                id={`${uid}-${step.id}`}
                type="checkbox"
                checked={doneSteps.includes(step.id)}
                onChange={(event) => {
                  setDoneSteps((current) =>
                    event.target.checked
                      ? [...current, step.id]
                      : current.filter((id) => id !== step.id),
                  );
                }}
              />{' '}
              <strong>
                {index + 1}. {step.label}
              </strong>
              <br />
              <small style={brgMuted}>{step.detail}</small>
            </label>
          </div>
        ))}
      </fieldset>
      <p style={brgNote}>
        Progres sesi: {doneSteps.length} dari {SESSION_STEPS.length} langkah.
      </p>
      <div style={brgField}>
        <label htmlFor={`${uid}-putar`} style={{ display: 'block' }}>
          <input
            id={`${uid}-putar`}
            type="checkbox"
            checked={putarHaluan}
            onChange={(event) => {
              setPutarHaluan(event.target.checked);
            }}
          />{' '}
          Arah berubah di tengah hari — putar haluan (kejar arah baru di SND
          berikutnya, jangan keras kepala pada analisa pagi)
        </label>
      </div>
      {putarHaluan ? (
        <p style={brgResult}>
          Putar haluan: tadinya {arahPagi === 'sell' ? 'sell' : 'buy'} karena mengira
          harga turun/naik, ternyata market berbalik — ubah jadi{' '}
          {arahPagi === 'sell' ? 'buy' : 'sell'} mengikuti market. Bila setelah
          diputar kalah lagi, stop — berarti market saat itu tidak berpihak pada
          metode. Counter-trend hanya boleh ditahan sebentar.
        </p>
      ) : null}
      <p style={brgNote}>
        Jangan masuk ke SND yang sudah tersentuh / selesai; jangan masuk saat
        sideways parah — skip momen. Jam malam: pergerakan gold biasanya lanjut terus
        tanpa koreksi dulu.
      </p>

      <h3>Tracker challenge</h3>
      <p style={brgMuted}>
        Syarat menurut video: jangan challenge-kan uang pribadi / tabungan. Trading
        biasa dulu sampai berkembang minimal 2× lipat dari modal; baru uang profitnya
        yang di-challenge-kan. Selama challenge, anggap saldo tetap modal awal —
        walau sudah jadi berkali-kali lipat.
      </p>
      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <NumberField
          id={`${uid}-modal`}
          label="Modal awal challenge (Rp)"
          value={modalAwal}
          onChange={setModalAwal}
          min={100_000}
          step={100_000}
          hint="Uang profit yang siap hilang, bukan tabungan."
        />
        <NumberField
          id={`${uid}-target`}
          label="Target saldo (Rp)"
          value={target}
          onChange={setTarget}
          min={100_000}
          step={100_000}
          hint="Buat target realistis, jangan terlalu tinggi."
        />
        <NumberField
          id={`${uid}-saldo`}
          label="Saldo berjalan (Rp)"
          value={saldo}
          onChange={setSaldo}
          min={0}
          step={100_000}
          hint="Selama challenge, anggap saldo tetap modal awal."
        />
        <NumberField
          id={`${uid}-part`}
          label="Part ke-"
          value={part}
          onChange={(value) => {
            setPart(Math.max(1, Math.round(value)));
          }}
          min={1}
          step={1}
          hint="Challenge dibuat per part karena tidak mungkin menang terus."
        />
      </div>
      <div style={brgResult} aria-live="polite">
        <p>
          Progres ke target: <strong>{fmt(progress, 1)}%</strong> (saldo Rp
          {fmt(saldo, 0)} dari target Rp{fmt(target, 0)}).
        </p>
        <p>
          Kenaikan dari modal awal:{' '}
          <strong>
            Rp{fmt(saldo - modalAwal, 0)} (
            {modalAwal > 0 ? fmt(((saldo - modalAwal) / modalAwal) * 100, 1) : '0'}
            %)
          </strong>
        </p>
        {targetTercapai ? (
          <p>
            <strong>Target tercapai.</strong> Tahu batas cukup: close dan berhenti.
            Bila dari modal awal saldo sudah membesar, tarik dulu minimal modal
            depositnya agar bila terjadi apa-apa tidak apa-apa.
          </p>
        ) : null}
        {nearTarget ? (
          <div style={brgWarning} role="alert">
            <strong>Sudah dekat target (≥90%).</strong> Menurut video, bila saldo
            mendekati target, tarik dulu modalnya agar psikologi aman — jangan
            &ldquo;genapin&rdquo; sampai saldo jadi nol.
          </div>
        ) : null}
      </div>

      <h3>Catat hasil</h3>
      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <NumberField
          id={`${uid}-perubahan`}
          label="Perubahan saldo (Rp, negatif bila rugi)"
          value={perubahan}
          onChange={setPerubahan}
          step={50_000}
          hint="RR di challenge: 1:1 — floating dan profit harus imbang."
        />
        <div style={brgField}>
          <label htmlFor={`${uid}-catatan`}>Catatan hasil</label>
          <input
            id={`${uid}-catatan`}
            type="text"
            style={{
              minHeight: 44,
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              background: 'var(--bg)',
              color: 'var(--text)',
              width: '100%',
            }}
            value={catatan}
            placeholder="mis. part 1 selesai, SND M1 bersih"
            onChange={(event) => {
              setCatatan(event.target.value);
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" style={brgButton} onClick={catatHasil}>
          Catat hasil
        </button>
        <button type="button" style={brgButtonSecondary} onClick={naikPart}>
          Lanjut ke part {part + 1}
        </button>
      </div>
      {log.length > 0 ? (
        <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
          <table style={brgTable}>
            <thead>
              <tr>
                <th scope="col" style={brgTh}>
                  Part
                </th>
                <th scope="col" style={brgTh}>
                  Perubahan
                </th>
                <th scope="col" style={brgTh}>
                  Saldo setelah
                </th>
                <th scope="col" style={brgTh}>
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody>
              {log.map((row) => (
                <tr key={row.id}>
                  <th scope="row" style={brgTd}>
                    {row.part}
                  </th>
                  <td style={brgTd}>
                    {row.perubahan >= 0 ? '+' : ''}Rp{fmt(row.perubahan, 0)}
                  </td>
                  <td style={brgTd}>Rp{fmt(row.saldoSetelah, 0)}</td>
                  <td style={brgTd}>{row.catatan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={brgNote}>Belum ada hasil yang dicatat pada challenge ini.</p>
      )}

      <h3>Contoh challenge dari video (klaim pembicara)</h3>
      <p style={brgMuted}>
        Rp1,5 jt → Rp109 jt (5 part: 10,8 → 25,3 → 55,1 → 93,6 → 109 jt); Rp2,5 jt
        → Rp103 jt (7 part); Rp1 jt → Rp12,5 jt dalam 4 hari; $250 → $1.000; $500
        → $2.300. Ulangi keberhasilan yang sama 3× sebelum menaikkan modal — bila
        profit Rp1 jt → Rp10 jt, ulangi 3 kali, baru naikkan modal bertahap.
      </p>
      <ClaimDisclaimer />
    </section>
  );
}
