# BangranFX Strategy Tools

Halaman **Strategi BRG — BangranFX** di aplikasi Trade merangkum metode Bang RAN
(RAN Trade Academy) untuk gold / XAU/USD — SNR "garis sakti", parallel channel,
multi-timeframe (MTF), SND, dan pola W/M — dari riset 91 video channel
[@bangranfx](https://www.youtube.com/@bangranfx) (6 Jan 2023 – 31 Agu 2026).
Ringkasan riset lengkap ada di `~/workspace/bangranfx/research/synthesis.md`
dan tutorial PDF 63 halaman di `~/workspace/your_files/Tutorial-Lengkap-BangranFX.pdf`.

> **Hanya untuk belajar. Bukan nasihat keuangan.** Klaim profit, angka challenge,
> dan win rate di video adalah **klaim pembicara, bukan fakta terverifikasi**
> secara independen. Metode ini belum dibacktest independen di sini — backtest
> dulu sebelum percaya metode apa pun.

## Cara menjalankan

```sh
corepack enable
pnpm install
pnpm --filter @trade/web dev    # server dev, buka di browser
pnpm --filter @trade/web build  # build produksi (tsc + vite)
pnpm typecheck                  # typecheck seluruh monorepo
pnpm lint                       # eslint seluruh monorepo
```

Membutuhkan Node.js >= 20 dan pnpm >= 9.

## Cara membuka halaman

- **Desktop:** klik tombol **BangranFX** pada bar kecil "Lihat: Chart | BangranFX"
  di bawah toolbar atas. Klik **Chart** untuk kembali ke chart utama.
- **Mobile:** ketuk tombol **BangranFX** di bottom navigation. Ketuk **Grafik**
  untuk kembali ke chart. Tombol Alat / Pantau / Panel kembali ke tampilan chart
  dan membuka sheet masing-masing.
- **Tema:** halaman memakai tema aplikasi (Terang / Gelap / Sistem) yang sama
  dengan chart utama. Pilihan tema ada di toolbar atas dan juga di pojok kanan
  header halaman BangranFX; tersimpan di `localStorage` (`trade:state:v1`).
  Tema gelap mengikuti `prefers-color-scheme` bila dipilih "Sistem".

Saat halaman BangranFX aktif, chart utama, panel bawah, dan sidebar disembunyikan;
footer disclaimer tetap tampil.

## Daftar modul

| Modul                          | File                                                            | Isi                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Halaman + navigasi + ringkasan | `apps/web/src/bangranfx/BangranFxPage.tsx`                      | Header, peringatan kejujuran, 5 tab, ringkasan metode statis (7 komponen BRG, tabel MTF, standar SL, glosarium 10 istilah) |
| Chart strategi                 | `apps/web/src/bangranfx/BrgChart.tsx`                           | Chart strategi dengan zona SNR/SND (data sintetis untuk belajar; lihat "Batasan" di bawah)                                 |
| Kalkulator                     | `apps/web/src/bangranfx/tools.tsx`                              | `LotCalculator`, `SlTpRrCalculator`, `LayeringCalculator`, `MmCalculator`, `MtfGuide`                                      |
| Wizard & checklist             | `apps/web/src/bangranfx/wizards.tsx`                            | `SnrWizard`, `SndWizard`, `EntryChecklist`, `JournalPanel`                                                                 |
| Sesi scalping                  | `apps/web/src/bangranfx/session.tsx`                            | `ScalpingSession` — alur kerja satu sesi scalping gold                                                                     |
| Navigasi                       | `apps/web/src/App.tsx`, `apps/web/src/components/BottomNav.tsx` | View `chart` \| `bangranfx`, bar "Lihat", tombol BangranFX di bottom nav                                                   |
| Gaya                           | `apps/web/src/index.css`                                        | Kelas `.brg-*` di akhir file (tema memakai token yang sudah ada)                                                           |

## Cara pakai tiap modul

### Ringkasan Metode (tab pertama)

Ringkasan statis yang selalu tersedia, walau modul lain bermasalah:

- **7 komponen BRG:** SNR/"garis sakti", parallel channel, MTF, SND, pola W & M,
  time trading, primary–secondary.
- **Tabel MTF:** scalping M30 → M5 → M1; intraday H4 → M30 → M15;
  swing Weekly → H4 → H1. Tentukan TF besar dulu baru TF kecil — jangan kebalik.
- **Standar SL:** scalping maks 20 pip, intraday 60 pip, swing 120 pip. Bila zona
  butuh SL lebih lebar, zona itu bukan zona yang bagus — jangan OP.
- **Glosarium 10 istilah:** SNR, SND, parallel channel, MTF, breakout, retest,
  pola W/M, SL, TP, RR.

### Chart Strategi

`BrgChart` menampilkan chart strategi dengan zona SNR/SND, memakai skenario contoh
sintetis deterministik dari `buildBrgExample()` di `data.ts` (candle gold sintetis

- SNR, zona SND, parallel channel, EMA 21/34/89, penanda pola W/M, dan preset
  sell 1943 dari Bab 9). Gunakan untuk belajar membaca zona, bukan sebagai sinyal
  entry. Entry yang benar menurut metode: tunggu breakout + close candle, tunggu
  retest ke zona, konfirmasi candle (engulfing/full body) atau pola M/W, lalu entry
  di SND TF terkecil.

### Kalkulator

- **`LotCalculator`** — lot dari risiko dan jarak SL. Prinsip: risiko ditentukan
  di awal (modal siap rugi → jarak SL → lot). "Lot itu tercipta setelah kita tahu
  risiko." Semakin besar SL, semakin kecil lot.
- **`SlTpRrCalculator`** — SL, TP, dan RR. RR minimal 1:2 (SL 10 pip → TP 20 pip).
  SL di support terdekat (buy) / resistance terdekat (sell), ditambah buffer lalu
  dibulatkan (18 pip → 20 pip).
- **`LayeringCalculator`** — open posisi berlapis dalam satu zona, maksimal
  5 layer. Layering persentase: total lot dihitung dulu dari batas rugi, baru
  dibagi ke layer. Layering full margin: lot berjenjang dari modal kecil, hanya
  dengan dana profit.
- **`MmCalculator`** — money management. MM persentase (risiko 1% per trade,
  deposit 30% dari total uang) vs MM hop-plus / all-in bertahap untuk modal kecil.
  Lihat catatan kontradiksi di bawah.
- **`MtfGuide`** — panduan pasangan TF per tipe trading (scalping / intraday /
  swing) dan urutan analisa major → konfirmasi → entry.

### Wizard & Checklist

- **`SnrWizard`** — langkah demi langkah menentukan SNR ("garis sakti").
- **`SndWizard`** — langkah demi langkah menentukan zona SND (fresh vs sudah
  tersentuh, gemuk/sedang/kurus, SND ganda).
- **`EntryChecklist`** — checklist sebelum OP: arah TF besar, breakout + close,
  retest, SND fresh, konfirmasi candle, SL/TP/lot sudah dihitung, risiko sudah
  siap. Bila satu item tidak terpenuhi: jangan OP.
- **`JournalPanel`** — jurnal trade sederhana (tanggal, arah, entry, SL, TP,
  hasil, catatan) untuk backtest dan evaluasi.

### Sesi & Jurnal

`ScalpingSession` memandu alur satu sesi scalping gold seperti di puluhan video
live trade: tentukan tren harian pagi hari → tentukan zona intraday (SND M15,
biasanya 1–2 kali sehari) → masuk TF kecil (M5/M1), tunggu break lalu retest →
entry di SND → tambah layer saat running → close sebagian saat profit → tahu
batas cukup dan berhenti hari itu bila market mulai melemah ("market butuh napas").

## Contoh hitungan terverifikasi — lot 0,10

Contoh dari video No. 50, dihitung ulang di sini (gold: 10 pip = perubahan
harga 1,00; 1 lot = 100 oz, jadi pergerakan 1,00 = $100 per lot):

- Modal **$1.000**, risiko **1%** = **$10**.
- Jarak SL **10 pip** (= 1,00 pergerakan harga) → nilai risiko per lot = $100.
- Lot = $10 ÷ $100 = **0,10 lot**. ✓
- Risiko 2% ($20) dengan SL yang sama → lot **0,20**. ✓
- SL 20 pip (= 2,00) dengan risiko $10 → nilai risiko per lot $200 →
  lot = $10 ÷ $200 = **0,05**. ✓

Rumus umum: **lot = risiko ($) ÷ (jarak SL dalam pip × $10 per pip per lot)**,
karena 1 pip gold (0,10) = $10 per lot.

Contoh RR 1:2 dari video No. 38 (Fibonacci sebagai penggaris RR): entry 1956,
SL 1954 (20 pip) → TP 1:1 di 1958, TP 1:2 di 1960.

## Catatan kejujuran + kontradiksi

Ditampilkan apa adanya di halaman (kotak peringatan di atas tab) dan di sini:

1. **Klaim profit tidak terverifikasi.** Angka challenge (mis. Rp1,5 jt →
   Rp109 jt dalam 5 part; $50 → $200; $250 → $1.000) dan win rate (mis. "dari
   100 data, benar 80 kalah 20") adalah klaim pembicara di video, tanpa
   verifikasi independen. Jangan dipakai sebagai janji hasil.
2. **Risiko 1% vs 30%/step.** Video No. 71/76 memakai risiko 1% per trade,
   sedangkan No. 79 (compounding 20 step, $20 → $2.926) memakai risiko 30%
   per step. Keduanya diajarkan di channel yang sama untuk situasi berbeda
   (modal besar vs modal sangat kecil). Ini dua jalur dengan profil risiko yang
   berbeda, bukan satu aturan.
3. **RR 1:2 vs 1:1.** Trading normal memakai RR minimal 1:2; challenge memakai
   RR 1:1 (floating dan profit harus imbang). Challenge juga tanpa cut loss di
   video scalping cepat — tetapi untuk trading harian, SL/cut loss itu WAJIB.
4. **Pola M di TF kecil tidak konsisten.** No. 34: di TF kecil, puncak kedua M
   harus LEBIH TINGGI dari pertama sebelum turun. No. 35 tampak menyatakan
   sebaliknya ("puncak kedua lebih rendah = lanjut turun"). Kedua versi
   ditampilkan apa adanya; jangan pakai satu versi seolah-olah pasti.
5. **GAP riset.** 2 dari 91 video tidak bisa diringkas dari transkrip: No. 3
   (seminar Surabaya, tanpa subtitle) dan No. 91 (tanpa subtitle/caption apa pun).
   Isi keduanya tidak dikarang.

## Batasan

- **Data chart sintetis untuk belajar.** `BrgChart` memakai data sintetis agar
  zona SNR/SND bisa dipelajari tanpa koneksi data. Ini bukan harga live dan
  bukan sinyal. Bila provider live tersedia (mis. Binance/OANDA lewat adapter
  yang sudah ada di aplikasi), chart strategi bisa dihubungkan ke data live —
  itu pekerjaan lanjutan, bukan bagian modul ini.
- **Tidak ada eksekusi order.** Semua modul di halaman ini adalah alat hitung,
  panduan, dan jurnal. Tidak ada yang mengirim order ke broker.
- **Tidak ada backtest otomatis.** Angka-angka di halaman berasal dari video;
  backtest independen (mis. replay di TradingView) adalah tanggung jawab
  pengguna sebelum memakai metode apa pun dengan uang nyata.
- **Uang dingin saja.** Sesuai ajaran channel: modal harus uang dingin / siap
  hilang, bukan uang hidup sehari-hari, bukan utang/pinjol.
