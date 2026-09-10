# Loket PLN ULP Agats

Aplikasi monitoring permohonan pasang baru / tambah daya, progres pekerjaan, dan buku kas Loket PLN ULP Agats.

## Stack

- **Vite** + Vanilla JS (ES modules)
- **Tailwind CSS** (build lokal, identitas warna PLN)
- **Firebase Firestore** (realtime) + Auth anonim
- **Chart.js** (grafik dashboard)
- **jsPDF** + autotable (rekap & kuitansi)
- **PWA** (installable, offline shell) via `vite-plugin-pwa`

## Menjalankan

```bash
npm install
npm run dev        # server pengembangan (http://localhost:5173)
npm run build      # build produksi ke dist/
npm run preview    # pratinjau hasil build
npm run icons      # regenerasi ikon PWA dari scripts/gen-icons.mjs
```

## Struktur

```
index.html            Shell: login, sidebar, bottom-nav, topbar, host modal/toast
src/
  main.js             Bootstrap, routing tab (+ hash), auth, wiring store
  firebase.js         Init Firebase + koleksi
  store.js            State, listener realtime, semua operasi tulis (business logic)
  style.css           Tailwind + komponen (.btn .card .input .badge .skeleton ...)
  lib/format.js       formatRp, tanggal, id, escape, parse angka
  lib/pdf.js          exportPermohonanPDF, cetakStruk
  lib/imageStore.js   compressImage (canvas), savePhoto/getPhoto (koleksi `bukti`)
  lib/gvImport.js     parseGvFile (SheetJS, lazy), importGv (sync koleksi `gvAgenda` + enrich permohonan)
  lib/harga.js        DEFAULT_HARGA + DEFAULT_TAMBAH_DAYA (seed) + kolom daftar harga
  ui/
    theme.js          Dark mode (tersimpan di localStorage + ikut sistem)
    toast.js          Notifikasi
    modal.js          openModal (bottom-sheet di mobile) + confirmDialog
    adminGate.js      requireAdmin(password) untuk edit/hapus
    components.js     statCard, emptyState, skeleton, filterChip, input Rupiah
  views/
    dashboard.js      Metrik, grafik 6 bulan, ringkasan hari ini, antrean pekerjaan, import GV
    permohonan.js     Daftar (tabel desktop / kartu mobile), filter, PDF, bayar, salin WA
    permForm.js       Form tambah/edit 2 langkah
    progress.js       Timeline 6 tahap + input biaya/link/agenda/pemasang
    kas.js            Buku kas, ringkasan, tambah/tarik/edit, saldo berjalan
    harga.js          Daftar Harga: kalkulator cepat + tabel biaya Pasang Baru per daya
public/               favicon.svg, icons/ (PWA)
reference/legacy.html Versi lama (arsip)
```

## Foto bukti (PPOB & Pemasangan)

Tahap **Pembayaran PPOB** dan **Pemasangan** di modal Progres sekarang pakai upload foto
langsung (bukan link GDrive). Foto dikompres di browser (maks 1080px, target < 230 KB) lalu
disimpan sebagai data URL JPEG di koleksi Firestore `bukti/{id}`. Dokumen kas terkait
menyimpan `buktiId`. Koleksi `bukti` TIDAK di-listen realtime — dimuat saat foto dibuka
(ada cache di memori). Tahap lain (NIDI/SLO, Upload Berkas) & data lama tetap pakai link.

Migrasi foto lama dari file lokal: lihat `scripts/migrate-photos.mjs` (konvensi nama
`REQ-xxxx-ppob.jpg` / `REQ-xxxx-pasang.jpg`).

## Import Data GV (lookup NOAGENDA)

Tombol **Import Data GV** di Dashboard: petugas pilih file `.xls`/`.xlsx` hasil export
"GV" dari aplikasi PLN. Aplikasi (SheetJS, di-lazy-load):
1. Baca kolom `NOAGENDA`, `NAMA`, `TGLMOHON`, `ASALMOHON`, `STATUS_PERMOHONAN`, dll.
2. Sinkron ke koleksi Firestore `gvAgenda` (doc id = NOAGENDA; baris yang hilang dari file
   baru akan dihapus). Meta import di `gvAgenda/zz-import-meta`.
3. Permohonan yang `noAgenda`-nya cocok → diisi field `asalMohon` & `statusPermohonan`
   (tampil sebagai badge di daftar & modal Progres).
4. Dashboard menampilkan kartu **"NOAGENDA Belum Masuk Permohonan"**: baris GV yang belum
   ada permohonan-nya. Jika ada permohonan dengan NAMA sama tapi nomor agenda beda,
   ditandai peringatan "kemungkinan salah ketik".
5. **Klik salah satu baris "belum masuk"** → form Tambah Permohonan terbuka, sudah terisi
   otomatis dari GV (nama, alamat + kel/kec/kab/prov hasil pisah, jenis, tarif, daya, biaya,
   `noAgenda`, `idpel`). Petugas tinggal isi NIK & cek alamat lalu simpan; baris otomatis
   hilang dari daftar. Nomor Agenda di modal Progres tahap 1 juga otomatis terisi.

Import bersifat **gabung (merge)**: baris dari import sebelumnya tidak pernah dihapus otomatis —
yang belum masuk permohonan tetap terpantau walau tidak ada di file GV terbaru. Baris yang
benar-benar batal/salah dihapus manual lewat tombol **×** pada tiap baris. Sebuah baris hilang
dari daftar hanya kalau permohonan dengan `noAgenda` sama sudah dibuat.

## Daftar Harga

Menu **Daftar Harga** (tab ke-4) dengan 2 sub-tab:

- **Pasang Baru** — tabel biaya per daya (BP + Token, NIDI+SLO, JSPIA, Total RT/Selain RT,
  Jasa Pasang, Saving). Koleksi Firestore `harga` (doc id = daya).
- **Tambah Daya** — matriks daya sebelum → sesudah (PD + Token, JSPIA, Total, Jasa, Saving).
  Koleksi `hargaTambahDaya` (doc id = `<sebelum>-<sesudah>`). Kolom **NIDI + SLO** sengaja
  kosong: hanya berlaku bila tambah daya 1 fasa → 3 fasa; admin isi per baris lewat tombol edit.

Tiap sub-tab punya **kalkulator cepat** (pilih daya/golongan → ringkasan biaya). Bila koleksi
kosong tampil data bawaan dari `src/lib/harga.js` + tombol **"Simpan ke Database"** (admin).
Tiap baris bisa diedit admin (ikon pensil). Kolom kiri (Daya/Daya Sebelum) dibekukan saat
tabel di-scroll di HP.

Angka **BP/PD & Total** = tabel PLN **dikurangi Rp 100.000** (loket tidak menyertakan token
100rb). `PB_RAW` / `td()` di `src/lib/harga.js` menyimpan nilai mentah lalu memotong 100rb di
satu tempat. Setelah mengubah nilai bawaan, jalankan `node scripts/seed-harga.mjs` untuk
menulis ulang koleksi Firestore.

### Penanda biaya vs daftar harga

Tiap permohonan diberi badge yang membandingkan **Total Biaya** (`p.biaya`) dengan **Total**
di daftar harga (`hargaTotalUntuk()` di `src/lib/harga.js`): **Pas** (hijau), **Kurang Rp X**
(merah), atau **Lebih Rp X** (biru). Golongan RT/Selain RT ditentukan dari `tarif`
(diawali `R` = RT). Untuk Tambah Daya perlu `dayaLama` — diambil dari kolom `DAYA_LAMA` GV
saat import (mengisi permohonan yang cocok) atau diisi manual di form. Badge tidak muncul bila
kombinasi daya tidak ada di daftar harga.

### Rincian Dana Loket

`rincianDana()` di `src/lib/harga.js` menghitung alur dana per permohonan (bila sudah ada
pembayaran masuk): `Dibayar pelanggan − PPOB − Jasa pasang(dibayar) − NIDI/SLO(dibayar) =
Sisa di loket`, lalu sisa dialokasikan ke Jasa Pasang & NIDI+SLO yang **belum** dibayar (nilai
dari daftar harga), sisanya = **Saving Loket**.

- **Modal Progres**: versi lengkap (mulai dari "Dibayar pelanggan").
- **Daftar permohonan** (tabel & kartu): versi ringkas `rincianMini()` — Sisa di loket,
  alokasi yang belum dibayar, dan Saving Loket. Angka negatif ditampilkan `−Rp X`.
- **Saving negatif → dianggap Rp 0** ("tidak ada saving"). `rincianDana` mengembalikan
  `saving` (di-clamp ≥ 0) dan `savingRaw` (nilai asli, untuk catatan "dana kurang …").
- Bila **Pasang Baru**, **Sisa di loket ≤ 0**, dan **NIDI+SLO belum dibayar** → muncul
  peringatan **"Belum ada biaya NIDI+SLO"** (di kotak ringkas & di modal Progres).
- **Dashboard** — 3 kartu turunan (jumlah permohonan + total rupiah, klik → daftar terfilter):
  - **Pasang Baru Biaya Rp 1** (`biaya ≤ 1`, + total biaya NIDI+SLO) → filter `biaya1`
  - **Dana NIDI+SLO di Loket** (`danaNidiDiLoket()` > 0: Pasang Baru, NIDI+SLO belum dibayar,
    sisa > 0 → `min(sisa, alokNidi)`) → filter `nidiHold`
  - **Permohonan Kurang Bayar** (`kekuranganBiaya()` > 0: `biaya < Total daftar harga`, +
    total kekurangan) → filter `kurang`

## Catatan keamanan

Login (`admin`/`admin`) dan password admin gate masih di sisi klien — sama seperti
versi lama. Untuk produksi sebaiknya dipindah ke Firebase Auth + Firestore Security Rules.
