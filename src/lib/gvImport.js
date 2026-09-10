import { gvCol, gvDoc, permCol, permDoc, newBatch, getDocs, deleteDoc } from '../firebase.js';
import { GV_META_ID } from '../store.js';

const clean = (v) => String(v ?? '').trim();
const num = (v) => Number(String(v ?? '0').replace(/[^\d]/g, '')) || 0;
// NOAGENDA idealnya tersimpan sebagai teks; kalau kebetulan angka, hindari notasi ilmiah.
const bigId = (v) =>
  typeof v === 'number' ? v.toLocaleString('fullwide', { useGrouping: false }) : clean(v);

// TGLMOHON bisa berupa Date (sel tanggal Excel) atau string "2026-08-14 08:13:52"
function fmtDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return clean(v).split(' ')[0];
}

/** Baca file .xls/.xlsx GV dan kembalikan array baris ternormalisasi. */
export async function parseGvFile(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('File tidak berisi sheet yang bisa dibaca.');
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });

  const rows = raw
    .map((r) => {
      const g = {};
      for (const k in r) g[String(k).trim().toUpperCase()] = r[k];
      return {
        noAgenda: bigId(g.NOAGENDA),
        nama: clean(g.NAMA),
        idpel: bigId(g.IDPEL),
        alamat: clean(g.ALAMAT).replace(/\s{2,}/g, ' '),
        telp: clean(g.NOTELP_HP_PEMOHON) || clean(g.NOTELP_PEMOHON),
        tglMohon: fmtDate(g.TGLMOHON),
        asalMohon: clean(g.ASALMOHON),
        statusPermohonan: clean(g.STATUS_PERMOHONAN),
        jenis: clean(g.JENIS_TRANSAKSI),
        tarif: clean(g.TARIF),
        daya: clean(g.DAYA),
        tarifLama: clean(g.TARIF_LAMA),
        dayaLama: clean(g.DAYA_LAMA),
        biaya: num(g.TOTALBIAYA),
      };
    })
    .filter((r) => /^\d{6,}$/.test(r.noAgenda));

  if (!rows.length) {
    throw new Error('Kolom NOAGENDA tidak ditemukan atau kosong. Pastikan file GV benar.');
  }
  // buang duplikat noAgenda (ambil yang pertama)
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.noAgenda) ? false : seen.add(r.noAgenda)));
}

/**
 * Simpan hasil import ke Firestore (mode GABUNG — tidak pernah menghapus otomatis):
 *  - semua baris file di-upsert ke koleksi `gvAgenda` (yang sudah ada diperbarui)
 *  - baris dari import sebelumnya TIDAK disentuh — yang belum masuk permohonan tetap terpantau
 *  - permohonan yang noAgenda-nya cocok diisi `asalMohon` & `statusPermohonan`
 *  - dok meta menyimpan info import terakhir
 * Baris yang benar-benar batal/salah dihapus manual lewat tombol × (deleteGvRow).
 * Return ringkasan { rows, baru, enriched, belumMasukFile }.
 */
export async function importGv(rows, fileName = '') {
  const [gvSnap, permSnap] = await Promise.all([getDocs(gvCol), getDocs(permCol)]);

  const existingIds = new Set(gvSnap.docs.map((d) => d.id));
  const perms = permSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const permByAgenda = new Map();
  perms.forEach((p) => {
    if (p.noAgenda) permByAgenda.set(String(p.noAgenda).trim(), p);
  });

  const ops = [];
  let enriched = 0;
  let baru = 0;
  const importedAt = new Date().toISOString();

  for (const r of rows) {
    if (!existingIds.has(r.noAgenda)) baru++;
    ops.push((b) => b.set(gvDoc(r.noAgenda), { ...r, importedAt }));
    const p = permByAgenda.get(r.noAgenda);
    if (!p) continue;
    const upd = {};
    if (p.asalMohon !== r.asalMohon) upd.asalMohon = r.asalMohon;
    if (p.statusPermohonan !== r.statusPermohonan) upd.statusPermohonan = r.statusPermohonan;
    // lengkapi daya lama utk perubahan daya (dipakai penanda biaya vs daftar harga)
    if (r.dayaLama && String(p.dayaLama || '') !== String(r.dayaLama)) upd.dayaLama = r.dayaLama;
    if (r.tarifLama && !p.tarifLama) upd.tarifLama = r.tarifLama;
    if (Object.keys(upd).length) {
      enriched++;
      ops.push((b) => b.set(permDoc(p.id), upd, { merge: true }));
    }
  }

  ops.push((b) =>
    b.set(gvDoc(GV_META_ID), {
      lastImportAt: importedAt,
      rows: rows.length,
      fileName,
      matched: rows.filter((r) => permByAgenda.has(r.noAgenda)).length,
    })
  );

  for (let i = 0; i < ops.length; i += 450) {
    const batch = newBatch();
    ops.slice(i, i + 450).forEach((fn) => fn(batch));
    await batch.commit();
  }

  return {
    rows: rows.length,
    baru,
    enriched,
    belumMasukFile: rows.filter((r) => !permByAgenda.has(r.noAgenda)).length,
  };
}

/** Hapus satu baris GV secara manual (mis. agenda dibatalkan / salah). */
export async function deleteGvRow(noAgenda) {
  await deleteDoc(gvDoc(noAgenda));
}
