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
    theme.js          Dark mode (default gelap, tersimpan di localStorage setelah diganti user)
    toast.js          Notifikasi
    modal.js          openModal (bottom-sheet di mobile) + confirmDialog
    adminGate.js      requireAdmin(password) untuk edit/hapus
    components.js     statCard, emptyState, skeleton, filterChip, input Rupiah
    nidiTanda.js      Penanda NIDI+SLO manual per permohonan (chip + pemilih)
  views/
    dashboard.js      Metrik, grafik saving & tarik kas 6 bulan, ringkasan hari ini, antrean pekerjaan, import GV
    permohonan.js     Daftar (tabel desktop / kartu mobile), filter, PDF, bayar, salin WA
    permForm.js       Form tambah/edit 2 langkah
    progress.js       Timeline 6 tahap + input biaya/link/agenda/pemasang
    kas.js            Buku kas, ringkasan, tambah/tarik/edit, saldo berjalan, filter jenis transaksi
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

3 sub-tab: **Pasang Baru**, **Tambah Daya**, **NIDI + SLO**. Tiap tabel harga punya
**kalkulator cepat**; bila koleksi kosong tampil data bawaan + tombol **"Simpan ke Database"**
(admin). Baris bisa diedit admin (ikon pensil). Tabel NIDI+SLO bisa **tambah / hapus** baris.
Kolom kiri (Daya/Daya Sebelum) dibekukan saat tabel di-scroll di HP.

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

**Dashboard** — kartu "Hari Ini" punya bagian **"Biaya vs Daftar Harga"**: jumlah permohonan
yang total biayanya **di bawah** total daftar harga (logika sama dengan badge "Kurang";
permohonan yang kombinasi dayanya tidak ada di daftar harga tidak dihitung), lengkap dengan
rincian per jenis (PB/TD). Klik → daftar permohonan terfilter (`filters.biaya = 'kurang'`).

### Biaya NIDI+SLO — tabel terpisah

Koleksi Firestore **`nidiSlo`** (doc id = daya, field `nidiSlo`) — tabel harga NIDI+SLO
per daya, terpisah dari daftar harga, ditampilkan sebagai sub-tab **"NIDI + SLO"** di menu
Daftar Harga (editable + tambah/hapus baris). Seed: `DEFAULT_NIDI_SLO` di `src/lib/harga.js`
(22 daya, 900–197.000) → `node scripts/seed-nidislo.mjs`.

`nidiSloWajib(p)` (`src/lib/harga.js`): baca dari tabel `nidiSlo` sesuai daya —
- **Pasang Baru** → selalu
- **Tambah Daya** → hanya bila `daya > 11.000` (1 fasa → 3 fasa)

Baris NIDI+SLO aktif dipegang di modul `harga.js` (`setNidiSloRows()` dari `store.js`) supaya
`nidiSloWajib(p)` tidak perlu argumen. Dipakai di `rincianDana()` untuk menghitung `alokNidi`.

### Penanda NIDI+SLO (manual)

Field `nidiTanda` di dok permohonan, diisi manual per permohonan (dicek satu per satu).
Nilai: `titip` / `tidak_titip` / `tidak_perlu` / `dibayar` (`src/ui/nidiTanda.js` → `NIDI_TANDA`).
Chip `nidiTandaChip()` tampil di daftar permohonan & header modal Progres — klik untuk
membuka pemilih (`openNidiTandaPicker`).

**Otomatis**: saat tahap "Pembayaran NIDI & SLO" (step 4) selesai, penanda `titip`
diubah jadi `dibayar` ("NIDI+SLO Sudah Dibayar Loket") di `completeStepWithCost()`.

**Dashboard** — bagian "Penanda NIDI+SLO": 5 kartu (jumlah permohonan per status: Titip,
Tidak Ada Titip, Tidak Perlu, Sudah Dibayar Loket, Belum Ditandai). Titip & Tidak Ada Titip
juga menampilkan total rupiah (`nidiSloWajib(p)` dijumlah). Klik kartu → daftar permohonan
terfilter (`filters.nidiTanda`, permohonan.js).

**Kartu "Kas yang Dapat Digunakan"** (di sebelah Total Saldo Kas, 4 kartu metrik) =
Total Saldo Kas − total rupiah Titip NIDI+SLO — dana Titip NIDI+SLO dianggap "titipan"
pelanggan, bukan kas bebas pakai loket. Di-clamp minimal Rp 0.

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
- Peringatan kuning "Belum ada biaya NIDI+SLO" (dulu muncul saat sisa loket ≤ 0 & NIDI+SLO
  belum dibayar) **sudah dihapus** atas permintaan petugas — informasinya sudah terwakili
  penanda NIDI+SLO manual + catatan kecil "dana kurang …" di modal Progres.
- **Dashboard** — kartu "Hari Ini" juga menampilkan jumlah permohonan **Ada saving loket**
  (`saving > 0`) dan **Tanpa saving loket** (`saving ≤ 0`), dihitung dari semua permohonan yang
  sudah ada pembayaran masuk (`rincianDana()` tidak `null`), dengan sub-rincian jumlah per jenis
  (Pasang Baru / Tambah Daya). Klik → daftar permohonan terfilter (`filters.saving`,
  permohonan.js).

### Grafik dashboard — Saving Loket & Tarik Kas

Grafik batang **3 bulan terakhir** di Dashboard (sebelumnya "Kas Masuk" 6 bulan) menampilkan
2 seri per bulan, dihitung dari koleksi `kas`:

- **Saving Loket** (hijau) = Kas Masuk (tipe `Pemasukan`) bulan itu − Pengeluaran terkait
  proyek (PPOB/Pemasangan/NIDI-SLO, tipe selain `Pemasukan`/`Penarikan`) bulan itu,
  di-clamp minimal Rp 0. Ini arus kas bulanan, beda dari `rincianDana()` per permohonan
  (yang juga memperhitungkan alokasi biaya yang belum dibayar).
- **Tarik Kas** (kuning) = total transaksi tipe `Penarikan` bulan itu.

Di bawah grafik ada **"Analisa Keperluan Tarik Kas"** (periode 3 bulan yang sama): tiap
transaksi `Penarikan` dikelompokkan berdasarkan kata kunci di keterangan (`KAS_KATEGORI` di
`dashboard.js` — Sosial & Kedukaan, Air Kantor, Konsumsi & Jamuan Tamu, Pekerjaan
Lapangan, Operasional & Administrasi, Lainnya sbg fallback), ditampilkan sebagai daftar
batang mini + rupiah + jumlah transaksi + persentase dari total tarik periode itu. Klasifikasi
berbasis regex kata kunci teks bebas (heuristik) — bukan field kategori terstruktur.

## Tema tampilan (gaya dashboard modern)

Tampilan memakai gaya dashboard gelap modern: latar navy pekat dengan cahaya lembut
(radial gradient di `body`), kartu `rounded-2xl` yang lebih terang dari latar, ikon
berbentuk badge gradasi, sidebar dengan pill aktif, dan topbar berisi sapaan + tanggal.

- `tailwind.config.js` — ujung gelap skala **`slate` di-remap** ke nuansa navy
  (`900 #121829` = kartu/sidebar, `800 #1b2235`, `700 #2b3449`) dan `surface.dark #080b14`
  = latar halaman. Karena seluruh view memakai `slate-700/800/900`, satu perubahan di sini
  menyeragamkan semua tampilan gelap. Ditambah aksen `iris` (ungu), `bg-grad-*` (gradasi),
  dan `shadow-glow-*`.
- `src/style.css` — `.card`, `.btn-primary` (gradasi biru PLN → ungu), `.input`, `.nav-item`
  (ikon jadi kotak kecil; aktif = gradasi + glow), helper `.icon-badge` + `.icon-pln/iris/leaf/gold`
  dan `.pill`.
- Warna identitas PLN tetap jadi warna utama; ungu hanya pasangan gradasi/aksen.
- Sapaan topbar ("Selamat Pagi/Siang/Sore/Malam") & pill tanggal diisi `renderTopbar()` di
  `src/main.js`.

Catatan: setelah mengubah `tailwind.config.js`, **restart dev server** — proses Vite yang
sedang jalan memakai konfigurasi lama dan `@apply` untuk utility baru akan error.

## Catatan keamanan

Login (`admin`/`admin`) dan password admin gate masih di sisi klien — sama seperti
versi lama. Untuk produksi sebaiknya dipindah ke Firebase Auth + Firestore Security Rules.
