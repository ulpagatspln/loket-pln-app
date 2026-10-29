import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRp, formatDate, formatDateShort } from './format.js';
import { kategoriTarik } from './kasKategori.js';

const PLN = [27, 117, 187];
const IRIS = [124, 92, 252];
const MERAH = [220, 38, 38];
const ABU = [100, 116, 139];

const rp = (n) => formatRp(Math.round(n || 0));
const tgl = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

/** Judul bagian; pindah halaman kalau ruang kurang. */
function judul(doc, teks, sub = '') {
  let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 34;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setTextColor(...PLN);
  doc.setFont(undefined, 'bold');
  doc.text(teks, 14, y);
  doc.setFont(undefined, 'normal');
  if (sub) {
    doc.setFontSize(8);
    doc.setTextColor(...ABU);
    doc.text(sub, 14, y + 4.5);
  }
  return y + (sub ? 8 : 4);
}

const tabel = (doc, startY, head, body, opts = {}) =>
  autoTable(doc, {
    startY,
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: opts.warna || PLN, fontSize: 8 },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    ...opts,
  });

/** Baris ringkas "label | nilai" untuk tabel dua kolom. */
const duaKolom = (rows) => rows.map(([a, b, tebal]) => [{ content: a, styles: tebal ? { fontStyle: 'bold' } : {} }, { content: b, styles: { halign: 'right', fontStyle: tebal ? 'bold' : 'normal' } }]);

export function exportAuditPDF(r) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();

  /* ===== Kop ===== */
  doc.setFillColor(...PLN);
  doc.rect(0, 0, W, 24, 'F');
  doc.setTextColor(255);
  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text('LAPORAN AUDIT LOKET PLN', 14, 11);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Periode ${tgl(r.periode.from)} s/d ${tgl(r.periode.to)}`, 14, 17.5);
  doc.setFontSize(7.5);
  doc.text(`Dicetak: ${formatDate(r.periode.dicetak)}`, W - 14, 17.5, { align: 'right' });
  doc.setTextColor(0);

  /* ===== 1. Ringkasan arus kas ===== */
  let y = judul(doc, '1. Arus Kas Periode', 'Alur uang masuk, keluar, dan sisa akhir periode');
  const k = r.kas;
  tabel(
    doc,
    y,
    ['Uraian', 'Jumlah'],
    duaKolom([
      ['Saldo awal periode', rp(k.saldoAwal), true],
      ['Uang masuk — pembayaran pelanggan', rp(k.masuk.pelanggan)],
      ['Uang masuk — tambah saldo (gabungan)', rp(k.masuk.manualGabungan)],
      ['Uang masuk — tambah saldo (safe deposit)', rp(k.masuk.manualSafe)],
      ['Total uang masuk', rp(k.masuk.total), true],
      ['Keluar — pembayaran BP di PPOB', '-' + rp(k.keluar.ppob)],
      ['Keluar — jasa pemasangan', '-' + rp(k.keluar.pasang)],
      ['Keluar — NIDI & SLO', '-' + rp(k.keluar.nidi)],
      ['Keluar — lainnya', '-' + rp(k.keluar.lain)],
      ['Total uang keluar (biaya proyek)', '-' + rp(k.keluar.total), true],
      ['Penarikan kas (operasional loket)', '-' + rp(k.tarik.total), true],
      ['Saldo akhir periode', rp(k.saldoAkhir), true],
    ])
  );

  /* ===== 2. Posisi kas saat ini ===== */
  y = judul(doc, '2. Posisi Kas Saat Ini', 'Komposisi saldo kas pada saat laporan dicetak');
  tabel(
    doc,
    y,
    ['Uraian', 'Jumlah'],
    duaKolom([
      ['Total saldo kas', rp(r.posisi.saldoKini), true],
      ['Titipan NIDI+SLO (belum disetor)', '-' + rp(r.posisi.titipanAktif)],
      ['Safe deposit (disisihkan)', '-' + rp(r.posisi.safeKini)],
      ['Kas yang dapat digunakan', rp(r.posisi.kasDapatDigunakan), true],
    ]),
    { warna: IRIS }
  );

  /* ===== 3. Permohonan masuk ===== */
  const m = r.permohonan.masuk;
  y = judul(doc, '3. Permohonan Masuk', 'Transaksi permohonan yang tercatat pada periode ini');
  tabel(doc, y, ['Kategori', 'Jumlah', 'Nilai Dibayar Pelanggan'], [
    ['Pasang Baru', `${m.pb} permohonan`, rp(m.rpPb)],
    ['Tambah Daya', `${m.td} permohonan`, rp(m.rpTd)],
    [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: `${m.count} permohonan`, styles: { fontStyle: 'bold' } }, { content: rp(m.rp), styles: { fontStyle: 'bold' } }],
    ['Status: Menunggu Pembayaran', `${r.permohonan.status['Menunggu Pembayaran']} permohonan`, '-'],
    ['Status: Lunas', `${r.permohonan.status.Lunas} permohonan`, '-'],
    ['Status: Selesai', `${r.permohonan.status.Selesai} permohonan`, '-'],
  ], { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });

  /* ===== 4. Penanda NIDI+SLO ===== */
  const LBL = {
    titip: 'Titip NIDI+SLO',
    tidak_titip: 'Tidak ada titip NIDI+SLO',
    tidak_perlu: 'Tidak perlu NIDI+SLO',
    dibayar: 'NIDI+SLO sudah dibayar loket',
    kosong: 'Belum ditandai',
  };
  y = judul(doc, '4. Penanda NIDI+SLO', 'Jumlah & nilai NIDI+SLO per penanda, dipisah jenis layanan');
  tabel(
    doc,
    y,
    ['Penanda', 'PB', 'TD', 'Total', 'Nilai NIDI+SLO'],
    Object.keys(LBL).map((key) => {
      const s = r.nidi[key];
      return [LBL[key], s.pb, s.td, s.count, rp(s.rp)];
    }),
    { columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' } } }
  );

  /* ===== 5. Saving loket ===== */
  y = judul(doc, '5. Saving Loket', 'Permohonan periode ini yang menghasilkan margin untuk loket');
  tabel(
    doc,
    y,
    ['Uraian', 'PB', 'TD', 'Total', 'Nilai Saving'],
    [
      ['Ada saving loket', r.saving.ada.pb, r.saving.ada.td, r.saving.ada.count, rp(r.saving.ada.rp)],
      ['Tanpa saving loket', r.saving.tanpa.pb, r.saving.tanpa.td, r.saving.tanpa.count, '-'],
      [
        { content: 'Rata-rata saving per permohonan', styles: { fontStyle: 'bold' } },
        '', '', '',
        { content: rp(r.saving.rata), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
    ],
    { columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' } } }
  );

  /* ===== 6. Biaya vs daftar harga ===== */
  y = judul(doc, '6. Kesesuaian Biaya dengan Daftar Harga', 'Pembanding total biaya pelanggan terhadap daftar harga');
  tabel(doc, y, ['Hasil', 'PB', 'TD', 'Total', 'Selisih'], [
    ['Kurang dari daftar harga', r.harga.kurang.pb, r.harga.kurang.td, r.harga.kurang.count, '-' + rp(r.harga.kurang.rp)],
    ['Sesuai daftar harga', r.harga.pas.pb, r.harga.pas.td, r.harga.pas.count, '-'],
    ['Lebih dari daftar harga', r.harga.lebih.pb, r.harga.lebih.td, r.harga.lebih.count, '+' + rp(r.harga.lebih.rp)],
    ['Tidak ada di daftar harga', r.harga.takAda.pb, r.harga.takAda.td, r.harga.takAda.count, '-'],
  ], { columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' } } });

  /* ===== 7. Penarikan kas per kategori ===== */
  y = judul(doc, '7. Rekap Penarikan Kas', 'Peruntukan uang yang ditarik dari kas selama periode');
  const totTarik = r.kas.tarik.total || 1;
  tabel(
    doc,
    y,
    ['Kategori', 'Transaksi', 'Nominal', '% dari total'],
    r.kas.tarik.perKategori.length
      ? [
          ...r.kas.tarik.perKategori.map((c) => [c.label, c.count, rp(c.total), `${Math.round((c.total / totTarik) * 100)}%`]),
          [
            { content: 'Total', styles: { fontStyle: 'bold' } },
            { content: String(r.kas.tarik.count), styles: { fontStyle: 'bold', halign: 'center' } },
            { content: rp(r.kas.tarik.total), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: '100%', styles: { fontStyle: 'bold', halign: 'right' } },
          ],
        ]
      : [[{ content: 'Tidak ada penarikan kas pada periode ini.', colSpan: 4, styles: { textColor: ABU } }]],
    { warna: [217, 142, 0], columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } } }
  );

  /* ===== 8. Antrean & data belum lengkap ===== */
  y = judul(doc, '8. Antrean Pekerjaan & Data Belum Lengkap', 'Posisi terkini (bukan hanya periode laporan)');
  tabel(doc, y, ['Uraian', 'Jumlah'], [
    ...r.antrean.map((a) => [`Belum ${a.label.toLowerCase()}`, `${a.count} permohonan`]),
    ['Lunas > 30 hari belum selesai', `${r.tertunda.length} permohonan`],
    ['NOAGENDA belum masuk permohonan', `${r.gv.belum.length} agenda (PB ${r.gv.pb} / TD ${r.gv.td})`],
  ], { columnStyles: { 1: { halign: 'right' } } });

  /* ===== 9. Temuan ===== */
  y = judul(doc, '9. Catatan & Temuan Audit');
  tabel(
    doc,
    y,
    ['#', 'Tingkat', 'Catatan'],
    r.temuan.map((t, i) => [
      i + 1,
      t.level === 'bahaya' ? 'PENTING' : t.level === 'peringatan' ? 'Perhatian' : 'Info',
      t.teks,
    ]),
    {
      warna: MERAH,
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 20 }, 2: { cellWidth: 'auto' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 1) {
          if (d.cell.raw === 'PENTING') d.cell.styles.textColor = MERAH;
          if (d.cell.raw === 'Perhatian') d.cell.styles.textColor = [217, 142, 0];
          d.cell.styles.fontStyle = 'bold';
        }
      },
    }
  );

  /* ===== LAMPIRAN ===== */
  doc.addPage();
  doc.setFontSize(13);
  doc.setTextColor(...PLN);
  doc.setFont(undefined, 'bold');
  doc.text('LAMPIRAN', 14, 18);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0);
  doc.lastAutoTable = { finalY: 12 };

  const L = r.lampiran;
  const kosong = (teks, kolom) => [[{ content: teks, colSpan: kolom, styles: { textColor: ABU } }]];

  y = judul(doc, 'Lampiran A — Pasang Baru tanpa saving loket', 'Dana yang masuk tidak menutup biaya PPOB, jasa pasang, dan NIDI+SLO');
  tabel(doc, y, ['ID', 'Tanggal', 'Pelanggan', 'Daya', 'Dibayar', 'Sisa di Loket', 'Kurang'],
    L.pbTanpaSaving.length
      ? L.pbTanpaSaving.map(({ p, d }) => [p.id, formatDateShort(p.date), p.nama, `${p.daya} VA`, rp(p.biaya), rp(d.sisa), d.savingRaw < 0 ? rp(-d.savingRaw) : '-'])
      : kosong('Tidak ada — semua Pasang Baru periode ini menghasilkan saving.', 7),
    { warna: MERAH, columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } } });

  y = judul(doc, 'Lampiran B — Tidak ada titipan NIDI+SLO', 'Biaya NIDI+SLO berpotensi ditanggung loket');
  tabel(doc, y, ['ID', 'Tanggal', 'Pelanggan', 'Layanan', 'Daya', 'Nilai NIDI+SLO'],
    L.tanpaTitip.length
      ? L.tanpaTitip.map(({ p, nidiSlo }) => [p.id, formatDateShort(p.date), p.nama, p.jenis, `${p.daya} VA`, rp(nidiSlo)])
      : kosong('Tidak ada.', 6),
    { warna: [217, 142, 0], columnStyles: { 5: { halign: 'right' } } });

  y = judul(doc, 'Lampiran C — Biaya kurang dari daftar harga');
  tabel(doc, y, ['ID', 'Tanggal', 'Pelanggan', 'Layanan', 'Dibayar', 'Daftar Harga', 'Kurang'],
    L.kurangBayar.length
      ? L.kurangBayar.map(({ p, h, selisih }) => [p.id, formatDateShort(p.date), p.nama, `${p.jenis} ${p.daya} VA`, rp(p.biaya), rp(h.total), rp(-selisih)])
      : kosong('Tidak ada.', 7),
    { warna: MERAH, columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } } });

  y = judul(doc, 'Lampiran D — Penarikan kas periode ini');
  tabel(doc, y, ['Tanggal', 'ID', 'Keterangan', 'Kategori', 'Nominal'],
    r.kas.tarik.rows.length
      ? [...r.kas.tarik.rows]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((t) => [formatDateShort(t.date), t.id, t.ket, kategoriTarik(t.ket).label, rp(t.nominal)])
      : kosong('Tidak ada penarikan kas.', 5),
    { warna: [217, 142, 0], columnStyles: { 3: { cellWidth: 34 }, 4: { halign: 'right' } } });

  y = judul(doc, 'Lampiran E — NOAGENDA belum masuk permohonan');
  tabel(doc, y, ['NOAGENDA', 'Nama', 'Alamat', 'Layanan', 'Daya'],
    r.gv.belum.length
      ? r.gv.belum.map((g) => [g.noAgenda, g.nama || '-', g.alamat || '-', g.jenis || '-', `${g.daya || '-'} VA`])
      : kosong('Semua NOAGENDA sudah dibuatkan permohonan.', 5),
    { warna: ABU, columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 'auto' }, 4: { halign: 'right' } } });

  if (L.belumDitandai.length) {
    y = judul(doc, 'Lampiran F — Permohonan belum diberi penanda NIDI+SLO');
    tabel(doc, y, ['ID', 'Tanggal', 'Pelanggan', 'Layanan', 'Daya'],
      L.belumDitandai.map((p) => [p.id, formatDateShort(p.date), p.nama, p.jenis, `${p.daya} VA`]), { warna: ABU });
  }
  if (L.biayaJanggal.length) {
    y = judul(doc, 'Lampiran G — Permohonan dengan biaya Rp 0 / Rp 1', 'Perlu dicek, kemungkinan input belum dilengkapi');
    tabel(doc, y, ['ID', 'Tanggal', 'Pelanggan', 'Layanan', 'Biaya'],
      L.biayaJanggal.map((p) => [p.id, formatDateShort(p.date), p.nama, `${p.jenis} ${p.daya} VA`, rp(p.biaya)]),
      { warna: ABU, columnStyles: { 4: { halign: 'right' } } });
  }

  /* ===== Footer halaman & tanda tangan ===== */
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...ABU);
    doc.text(`Laporan Audit Loket PLN — ${tgl(r.periode.from)} s/d ${tgl(r.periode.to)}`, 14, 290);
    doc.text(`Halaman ${i} dari ${total}`, W - 14, 290, { align: 'right' });
  }

  doc.save(`Audit_Loket_PLN_${r.periode.from}_sd_${r.periode.to}.pdf`);
}
