// Daftar harga Biaya Pasang Baru / Tambah Daya per daya.
// RT = Rumah Tangga, Selain RT = non-rumah tangga.
// Dipakai sebagai seed; data aktif dibaca dari koleksi Firestore `harga` / `hargaTambahDaya` (bisa diedit admin).
//
// Catatan: angka BP/PD & Total pada tabel PLN aslinya SUDAH termasuk token Rp 100.000.
// Loket Agats tidak menyertakan token itu, jadi BP/PD dan Total dikurangi Rp 100.000.

const TOKEN = 100000;

export const HARGA_COLS = [
  { key: 'bpRt', label: 'BP (RT)', group: 'BP', sub: 'RT' },
  { key: 'bpNonRt', label: 'BP (Selain RT)', group: 'BP', sub: 'Selain RT' },
  { key: 'nidiSlo', label: 'NIDI + SLO', group: '', sub: '' },
  { key: 'jspia', label: 'JSPIA', group: '', sub: '' },
  { key: 'nidiSloMatJspia', label: 'NIDI + SLO + Materai + JSPIA', group: '', sub: '' },
  { key: 'totalRt', label: 'Total (RT)', group: 'Total', sub: 'RT', total: true },
  { key: 'totalNonRt', label: 'Total (Selain RT)', group: 'Total', sub: 'Selain RT', total: true },
  { key: 'jasaPasang', label: 'Jasa Pasang', group: '', sub: '' },
  { key: 'saving', label: 'Saving', group: '', sub: '' },
];

// Nilai mentah = persis tabel PLN (termasuk token 100rb). Transform di bawah mengurangi 100rb.
const PB_RAW = [
  { daya: 900, bpRt: 943000, bpNonRt: 943000, nidiSlo: 185000, jspia: 674000, nidiSloMatJspia: 859000, totalRt: 1802000, totalNonRt: 1802000, jasaPasang: 300000, saving: 374000 },
  { daya: 1300, bpRt: 1318000, bpNonRt: 1318000, nidiSlo: 280000, jspia: 919000, nidiSloMatJspia: 1199000, totalRt: 2517000, totalNonRt: 2517000, jasaPasang: 300000, saving: 619000 },
  { daya: 2200, bpRt: 2162000, bpNonRt: 2162000, nidiSlo: 382000, jspia: 973000, nidiSloMatJspia: 1355000, totalRt: 3517000, totalNonRt: 3517000, jasaPasang: 300000, saving: 673000 },
  { daya: 3500, bpRt: 3491500, bpNonRt: 3491500, nidiSlo: 505000, jspia: 1021400, nidiSloMatJspia: 1526400, totalRt: 5017900, totalNonRt: 5017900, jasaPasang: 300000, saving: 721400 },
  { daya: 4400, bpRt: 4363600, bpNonRt: 4363600, nidiSlo: 625000, jspia: 1594400, nidiSloMatJspia: 2219400, totalRt: 6583000, totalNonRt: 6583000, jasaPasang: 300000, saving: 1294400 },
  { daya: 5500, bpRt: 5349500, bpNonRt: 5349500, nidiSlo: 770000, jspia: 1995500, nidiSloMatJspia: 2765500, totalRt: 8115000, totalNonRt: 8115000, jasaPasang: 300000, saving: 1695500 },
  { daya: 6600, bpRt: 6505400, bpNonRt: 6505400, nidiSlo: 1070000, jspia: 3459000, nidiSloMatJspia: 4529000, totalRt: 11034400, totalNonRt: 11034400, jasaPasang: 900000, saving: 2559000 },
  { daya: 7700, bpRt: 8392043, bpNonRt: 7571300, nidiSlo: 1475000, jspia: 2997700, nidiSloMatJspia: 4472700, totalRt: 12864743, totalNonRt: 12044000, jasaPasang: 900000, saving: 2097700 },
  { daya: 10600, bpRt: 11511254, bpNonRt: 10381400, nidiSlo: 1408000, jspia: 4500000, nidiSloMatJspia: 5908000, totalRt: 17419254, totalNonRt: 16289400, jasaPasang: 900000, saving: 3600000 },
  { daya: 13200, bpRt: 14307788, bpNonRt: 12900800, nidiSlo: 1746000, jspia: 5064000, nidiSloMatJspia: 6810000, totalRt: 21117788, totalNonRt: 19710800, jasaPasang: 900000, saving: 4164000 },
  { daya: 16500, bpRt: 17857235, bpNonRt: 16098500, nidiSlo: 2175000, jspia: 5775000, nidiSloMatJspia: 7950000, totalRt: 25807235, totalNonRt: 24048500, jasaPasang: 900000, saving: 4875000 },
  { daya: 23000, bpRt: 24848570, bpNonRt: 22397000, nidiSlo: 2445000, jspia: 7475000, nidiSloMatJspia: 9920000, totalRt: 34768570, totalNonRt: 32317000, jasaPasang: 900000, saving: 6575000 },
  { daya: 33000, bpRt: 35604470, bpNonRt: 32087000, nidiSlo: 3330000, jspia: 9900000, nidiSloMatJspia: 13230000, totalRt: 48834470, totalNonRt: 45317000, jasaPasang: 900000, saving: 9000000 },
];

export const DEFAULT_HARGA = PB_RAW.map((r) => ({
  ...r,
  bpRt: r.bpRt - TOKEN,
  bpNonRt: r.bpNonRt - TOKEN,
  totalRt: r.totalRt - TOKEN,
  totalNonRt: r.totalNonRt - TOKEN,
}));

export const activeHarga = (rows) =>
  (rows && rows.length ? [...rows] : [...DEFAULT_HARGA]).sort((a, b) => a.daya - b.daya);

/* ============ TAMBAH DAYA (matriks daya sebelum -> sesudah) ============ */

export const TAMBAH_DAYA_FIELDS = [
  { key: 'pdRt', label: 'PD — RT' },
  { key: 'pdNonRt', label: 'PD — Selain RT' },
  { key: 'nidiSlo', label: 'NIDI + SLO (isi bila 1 fasa → 3 fasa)' },
  { key: 'jspia', label: 'JSPIA' },
  { key: 'totalRt', label: 'Total — RT' },
  { key: 'totalNonRt', label: 'Total — Selain RT' },
  { key: 'jasaPasang', label: 'Jasa Pasang' },
  { key: 'saving', label: 'Saving' },
];

// pdRt/pdNonRt & totalRt/totalNonRt dikurangi token 100rb di sini.
const td = (sebelum, sesudah, pdRt, pdNonRt, jspia, totalRt, totalNonRt, jasaPasang, saving) => ({
  sebelum,
  sesudah,
  pdRt: pdRt - TOKEN,
  pdNonRt: pdNonRt - TOKEN,
  nidiSlo: 0,
  jspia,
  totalRt: totalRt - TOKEN,
  totalNonRt: totalNonRt - TOKEN,
  jasaPasang,
  saving,
});

export const DEFAULT_TAMBAH_DAYA = [
  td(450, 900, 521650, 521650, 674000, 1195650, 1195650, 300000, 374000),
  td(450, 1300, 896450, 896450, 919000, 1815450, 1815450, 300000, 619000),
  td(450, 2200, 1739750, 1739750, 973000, 2712750, 2712750, 300000, 673000),
  td(450, 3500, 3055450, 3055450, 1021400, 4076850, 4076850, 300000, 721400),
  td(450, 4400, 3927550, 3927550, 1594400, 5521950, 5521950, 300000, 1294400),
  td(450, 5500, 4993450, 4993450, 1995500, 6988950, 6988950, 300000, 1695500),
  td(450, 7700, 7908027, 7135250, 2997700, 10905727, 10132950, 900000, 2097700),
  td(900, 1300, 474800, 474800, 919000, 1393800, 1393800, 300000, 619000),
  td(900, 2200, 1318100, 1318100, 973000, 2291100, 2291100, 300000, 673000),
  td(900, 3500, 2619400, 2619400, 1021400, 3640800, 3640800, 300000, 721400),
  td(900, 4400, 3491500, 3491500, 1594400, 5085900, 5085900, 300000, 1294400),
  td(900, 5500, 4557400, 4557400, 1995500, 6552900, 6552900, 300000, 1695500),
  td(900, 7700, 7424012, 6699200, 2997700, 10421712, 9696900, 900000, 2097700),
  td(1300, 2200, 943300, 943300, 973000, 1916300, 1916300, 300000, 673000),
  td(1300, 3500, 2231800, 2231800, 1021400, 3253200, 3253200, 300000, 721400),
  td(1300, 4400, 3103900, 3103900, 1594400, 4698300, 4698300, 300000, 1294400),
  td(1300, 5500, 4169800, 4169800, 1995500, 6165300, 6165300, 300000, 1695500),
  td(1300, 7700, 6993776, 6311600, 2997700, 9991476, 9309300, 900000, 2097700),
  td(2200, 3500, 1359700, 1359700, 1021400, 2381100, 2381100, 300000, 721400),
  td(2200, 4400, 2231800, 2231800, 1594400, 3826200, 3826200, 300000, 1294400),
  td(2200, 5500, 3297700, 3297700, 1995500, 5293200, 5293200, 300000, 1695500),
  td(2200, 7700, 6025745, 5439500, 2997700, 9023445, 8437200, 900000, 2097700),
  td(3500, 4400, 972100, 972100, 1594400, 2566500, 2566500, 300000, 1294400),
  td(3500, 5500, 2038000, 2038000, 1995500, 4033500, 4033500, 300000, 1695500),
  td(3500, 7700, 4617478, 4169800, 2997700, 7615178, 7167500, 900000, 2097700),
  td(4400, 5500, 1165900, 1165900, 1995500, 3161400, 3161400, 300000, 1695500),
  td(4400, 7700, 3649447, 3297700, 2997700, 6647147, 6295400, 900000, 2097700),
  td(5500, 7700, 2466298, 2231800, 2997700, 5463998, 5229500, 900000, 2097700),
];

export const activeTambahDaya = (rows) =>
  (rows && rows.length ? [...rows] : [...DEFAULT_TAMBAH_DAYA]).sort(
    (a, b) => a.sebelum - b.sebelum || a.sesudah - b.sesudah
  );

/* ============ helper pembanding untuk permohonan ============ */

// Tarif R* = Rumah Tangga; selain itu (B/P/S/I) = Selain RT.
export const isRt = (tarif = '') => /^\s*R/i.test(String(tarif));

/**
 * Total daftar harga yang seharusnya dibayar pelanggan untuk sebuah permohonan.
 * Return { total, rt, kind } atau null bila tidak ada di daftar harga.
 */
export function hargaTotalUntuk(p, hargaRows, tdRows) {
  if (!p) return null;
  const rt = isRt(p.tarif);
  const daya = Number(p.daya);
  const isTambahDaya = /tambah daya|perubahan daya/i.test(p.jenis || '');

  if (isTambahDaya) {
    const lama = Number(p.dayaLama);
    if (!lama) return null;
    const row = activeTambahDaya(tdRows).find((r) => r.sebelum === lama && r.sesudah === daya);
    if (!row) return null;
    return { total: rt ? row.totalRt : row.totalNonRt, rt, kind: 'Tambah Daya', row };
  }

  const row = activeHarga(hargaRows).find((r) => r.daya === daya);
  if (!row) return null;
  return { total: rt ? row.totalRt : row.totalNonRt, rt, kind: 'Pasang Baru', row };
}

/**
 * Rincian dana loket untuk sebuah permohonan berdasarkan transaksi kas.
 * Return null bila belum ada pembayaran masuk.
 */
export function rincianDana(p, kasRows, hargaRows, tdRows) {
  if (!p) return null;
  const forP = (m) => kasRows.find((k) => k.refId === p.id && (k.ket || '').includes(m));
  const masuk = kasRows
    .filter((k) => k.refId === p.id && k.tipe === 'Pemasukan')
    .reduce((s, k) => s + (k.nominal || 0), 0);
  if (masuk <= 0) return null;

  const ppob = forP('PPOB')?.nominal || 0;
  const jasaPasangPaid = forP('Pemasangan')?.nominal || 0;
  const nidiPaid = forP('NIDI')?.nominal || 0;
  const sisa = masuk - ppob - jasaPasangPaid - nidiPaid;

  const ref = hargaTotalUntuk(p, hargaRows, tdRows);
  const jasaBelum = jasaPasangPaid === 0;
  const nidiBelum = nidiPaid === 0;
  const alokJasa = jasaBelum && ref ? ref.row.jasaPasang || 0 : 0;
  const alokNidi = nidiBelum && ref ? ref.row.nidiSlo || 0 : 0;
  const savingRaw = sisa - alokJasa - alokNidi;
  const saving = Math.max(0, savingRaw); // saving minus -> dianggap 0 (tidak ada saving)

  return {
    masuk, ppob, jasaPasangPaid, nidiPaid, sisa,
    jasaBelum, nidiBelum, alokJasa, alokNidi, saving, savingRaw, ref,
  };
}

/** Kekurangan biaya permohonan dibanding Total daftar harga (0 bila pas/lebih/tidak ada acuan). */
export function kekuranganBiaya(p, hargaRows, tdRows) {
  const h = hargaTotalUntuk(p, hargaRows, tdRows);
  if (!h) return 0;
  const selisih = Number(p?.biaya || 0) - h.total;
  return selisih < 0 ? -selisih : 0;
}

/**
 * Dana NIDI+SLO milik pelanggan Pasang Baru yang benar-benar tersimpan di loket:
 * NIDI+SLO belum dibayar DAN masih ada saving loket (> 0) — artinya dana pelanggan
 * cukup menutup semua alokasi termasuk NIDI+SLO. Return biaya NIDI+SLO (0 bila tidak).
 */
export function danaNidiDiLoket(p, kasRows, hargaRows, tdRows) {
  const d = rincianDana(p, kasRows, hargaRows, tdRows);
  if (!d || d.ref?.kind !== 'Pasang Baru' || d.alokNidi <= 0 || d.saving <= 0) return 0;
  return d.alokNidi;
}

/** true bila permohonan sudah dibayar tapi tidak menyisakan saving loket (saving = 0). */
export function tanpaSavingLoket(p, kasRows, hargaRows, tdRows) {
  const d = rincianDana(p, kasRows, hargaRows, tdRows);
  return !!d && d.saving === 0;
}
