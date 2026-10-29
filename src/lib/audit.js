/**
 * Perhitungan laporan audit periode tertentu.
 * Murni hitung dari `state` — tidak menyentuh UI, dipakai view Audit & export PDF.
 */
import { state, calculateSaldo, potKas, gvBelumMasuk, PROGRESS_STEPS } from '../store.js';
import { hargaTotalUntuk, rincianDana, nidiSloWajib } from './harga.js';
import { kategoriTarik, KAS_KATEGORI } from './kasKategori.js';
import { NIDI_TANDA } from '../ui/nidiTanda.js';

const isTD = (p) => p.jenis === 'Tambah Daya';
const blank = () => ({ count: 0, pb: 0, td: 0, rp: 0, rpPb: 0, rpTd: 0 });

function add(acc, p, rp = 0) {
  acc.count++;
  acc.rp += rp;
  if (isTD(p)) {
    acc.td++;
    acc.rpTd += rp;
  } else {
    acc.pb++;
    acc.rpPb += rp;
  }
  return acc;
}

/** Batas periode: 00:00:00 tanggal awal s/d 23:59:59 tanggal akhir. */
export function rangeBounds(from, to) {
  return [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`)];
}

export function buildAudit({ from, to }) {
  const [awal, akhir] = rangeBounds(from, to);
  const inRange = (d) => {
    const t = new Date(d);
    return t >= awal && t <= akhir;
  };

  /* ---------- KAS ---------- */
  const kasSebelum = state.kas.filter((k) => new Date(k.date) < awal);
  const kasPeriode = state.kas.filter((k) => inRange(k.date));
  const sum = (rows, f = () => true) => rows.filter(f).reduce((s, k) => s + (k.nominal || 0), 0);
  const saldoDari = (rows) => rows.reduce((s, k) => (k.tipe === 'Pemasukan' ? s + k.nominal : s - k.nominal), 0);

  const masukPelanggan = sum(kasPeriode, (k) => k.tipe === 'Pemasukan' && k.refId);
  const masukManualGab = sum(kasPeriode, (k) => k.tipe === 'Pemasukan' && !k.refId && potKas(k) !== 'safe');
  const masukManualSafe = sum(kasPeriode, (k) => k.tipe === 'Pemasukan' && !k.refId && potKas(k) === 'safe');

  const keluarRows = kasPeriode.filter((k) => k.tipe !== 'Pemasukan' && k.tipe !== 'Penarikan');
  const cat = (m) => sum(keluarRows, (k) => (k.ket || '').includes(m));
  const keluarPpob = cat('PPOB');
  const keluarPasang = cat('Pemasangan');
  const keluarNidi = cat('NIDI');
  const keluarTotal = sum(keluarRows);

  const tarikRows = kasPeriode.filter((k) => k.tipe === 'Penarikan');
  const tarikTotal = sum(tarikRows);
  const tarikPerKategori = KAS_KATEGORI.map((c) => {
    const rows = tarikRows.filter((k) => kategoriTarik(k.ket).key === c.key);
    return { key: c.key, label: c.label, rgb: c.rgb, count: rows.length, total: sum(rows) };
  })
    .filter((c) => c.count)
    .sort((a, b) => b.total - a.total);

  const saldoAwal = saldoDari(kasSebelum);
  const saldoAkhir = saldoAwal + saldoDari(kasPeriode);
  const safeAwal = saldoDari(kasSebelum.filter((k) => potKas(k) === 'safe'));
  const safeAkhir = safeAwal + saldoDari(kasPeriode.filter((k) => potKas(k) === 'safe'));

  /* ---------- PERMOHONAN PERIODE ---------- */
  const perms = state.permohonan.filter((p) => inRange(p.date));
  const masuk = blank();
  const statusCount = { 'Menunggu Pembayaran': 0, Lunas: 0, Selesai: 0 };
  const nidiStat = {};
  ['titip', 'tidak_titip', 'tidak_perlu', 'dibayar', 'kosong'].forEach((k) => (nidiStat[k] = blank()));
  const savingAda = blank();
  const savingTanpa = blank();
  const hargaKurang = blank();
  const hargaPas = blank();
  const hargaLebih = blank();
  const hargaTakAda = blank();
  const lampiran = { pbTanpaSaving: [], tanpaTitip: [], kurangBayar: [], belumDitandai: [], biayaJanggal: [] };

  for (const p of perms) {
    add(masuk, p, Number(p.biaya || 0));
    if (statusCount[p.status] != null) statusCount[p.status]++;

    // Penanda NIDI+SLO
    const key = p.nidiTanda && NIDI_TANDA[p.nidiTanda] ? p.nidiTanda : 'kosong';
    add(nidiStat[key], p, nidiSloWajib(p));
    if (key === 'kosong') lampiran.belumDitandai.push(p);
    if (key === 'tidak_titip') lampiran.tanpaTitip.push({ p, nidiSlo: nidiSloWajib(p) });

    // Saving loket
    const d = rincianDana(p, state.kas, state.harga, state.hargaTd);
    if (d) {
      if (d.saving > 0) add(savingAda, p, d.saving);
      else {
        add(savingTanpa, p, 0);
        if (!isTD(p)) lampiran.pbTanpaSaving.push({ p, d });
      }
    }

    // Biaya vs daftar harga
    const h = hargaTotalUntuk(p, state.harga, state.hargaTd);
    if (!h) add(hargaTakAda, p, 0);
    else {
      const selisih = Number(p.biaya || 0) - h.total;
      if (selisih < 0) {
        add(hargaKurang, p, -selisih);
        lampiran.kurangBayar.push({ p, h, selisih });
      } else if (selisih === 0) add(hargaPas, p, 0);
      else add(hargaLebih, p, selisih);
    }

    if (Number(p.biaya || 0) <= 1) lampiran.biayaJanggal.push(p);
  }

  /* ---------- ANTREAN & GV (posisi saat ini) ---------- */
  const antrean = PROGRESS_STEPS.map((label, i) => ({
    step: i,
    label,
    count: state.permohonan.filter((p) => p.status === 'Lunas' && p.step === i).length,
  }));
  const now = Date.now();
  const tertunda = state.permohonan.filter(
    (p) => p.status === 'Lunas' && p.step < 6 && (now - new Date(p.date)) / 864e5 > 30
  );
  const gvBelum = gvBelumMasuk();
  const gvPb = gvBelum.filter((r) => !/PERUBAHAN DAYA/i.test(r.jenis || '')).length;

  /* ---------- POSISI KAS SAAT INI ---------- */
  const saldoKini = calculateSaldo();
  const titipanAktif = state.permohonan
    .filter((p) => p.nidiTanda === 'titip')
    .reduce((s, p) => s + nidiSloWajib(p), 0);
  const safeKini = state.kas.reduce(
    (s, k) => (potKas(k) !== 'safe' ? s : k.tipe === 'Pemasukan' ? s + k.nominal : s - k.nominal),
    0
  );
  const kasDapatDigunakan = saldoKini - titipanAktif - safeKini;

  /* ---------- TEMUAN ---------- */
  const rp = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  const temuan = [];
  if (kasDapatDigunakan < 0) {
    temuan.push({
      level: 'bahaya',
      teks: `Kas yang dapat digunakan MINUS ${rp(-kasDapatDigunakan)}. Dana titipan NIDI+SLO (${rp(titipanAktif)}) dan/atau safe deposit kemungkinan sudah terpakai untuk keperluan lain.`,
    });
  } else {
    temuan.push({
      level: 'info',
      teks: `Dana titipan NIDI+SLO ${rp(titipanAktif)} masih tertutup saldo kas. Sisa kas bebas pakai ${rp(kasDapatDigunakan)}.`,
    });
  }
  if (savingTanpa.pb)
    temuan.push({
      level: 'bahaya',
      teks: `${savingTanpa.pb} permohonan Pasang Baru pada periode ini tidak menghasilkan saving loket (lihat Lampiran A).`,
    });
  if (hargaKurang.count)
    temuan.push({
      level: 'peringatan',
      teks: `${hargaKurang.count} permohonan dibayar di bawah daftar harga, total kekurangan ${rp(hargaKurang.rp)} (PB ${hargaKurang.pb} / TD ${hargaKurang.td}) — lihat Lampiran C.`,
    });
  if (nidiStat.tidak_titip.count)
    temuan.push({
      level: 'peringatan',
      teks: `${nidiStat.tidak_titip.count} permohonan tidak menitipkan biaya NIDI+SLO senilai ${rp(nidiStat.tidak_titip.rp)} — berpotensi ditanggung loket (lihat Lampiran B).`,
    });
  if (tarikTotal > savingAda.rp)
    temuan.push({
      level: 'peringatan',
      teks: `Penarikan kas periode ini ${rp(tarikTotal)} melebihi saving yang dihasilkan ${rp(savingAda.rp)}; selisih ${rp(tarikTotal - savingAda.rp)} diambil dari saldo sebelumnya.`,
    });
  if (lampiran.biayaJanggal.length)
    temuan.push({
      level: 'peringatan',
      teks: `${lampiran.biayaJanggal.length} permohonan tercatat dengan total biaya Rp 1 atau Rp 0 — kemungkinan input belum dilengkapi.`,
    });
  if (nidiStat.kosong.count)
    temuan.push({
      level: 'peringatan',
      teks: `${nidiStat.kosong.count} permohonan belum diberi penanda NIDI+SLO sehingga belum terhitung di rekap titipan.`,
    });
  if (tertunda.length)
    temuan.push({
      level: 'peringatan',
      teks: `${tertunda.length} permohonan sudah lunas lebih dari 30 hari tetapi tahapannya belum selesai.`,
    });
  if (gvBelum.length)
    temuan.push({
      level: 'info',
      teks: `${gvBelum.length} NOAGENDA dari data GV belum dibuatkan permohonan (PB ${gvPb} / TD ${gvBelum.length - gvPb}) — lihat Lampiran E.`,
    });

  return {
    periode: { from, to, dicetak: new Date().toISOString() },
    kas: {
      saldoAwal,
      saldoAkhir,
      masuk: {
        pelanggan: masukPelanggan,
        manualGabungan: masukManualGab,
        manualSafe: masukManualSafe,
        total: masukPelanggan + masukManualGab + masukManualSafe,
        count: kasPeriode.filter((k) => k.tipe === 'Pemasukan').length,
      },
      keluar: {
        ppob: keluarPpob,
        pasang: keluarPasang,
        nidi: keluarNidi,
        lain: keluarTotal - keluarPpob - keluarPasang - keluarNidi,
        total: keluarTotal,
        count: keluarRows.length,
      },
      tarik: { total: tarikTotal, count: tarikRows.length, perKategori: tarikPerKategori, rows: tarikRows },
      safe: { awal: safeAwal, akhir: safeAkhir, selisih: safeAkhir - safeAwal },
    },
    posisi: { saldoKini, titipanAktif, safeKini, kasDapatDigunakan },
    permohonan: { masuk, status: statusCount },
    nidi: nidiStat,
    saving: { ada: savingAda, tanpa: savingTanpa, rata: savingAda.count ? savingAda.rp / savingAda.count : 0 },
    harga: { kurang: hargaKurang, pas: hargaPas, lebih: hargaLebih, takAda: hargaTakAda },
    antrean,
    tertunda,
    gv: { belum: gvBelum, pb: gvPb, td: gvBelum.length - gvPb },
    temuan,
    lampiran,
  };
}
