import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRp, formatDate, formatDateShort } from './format.js';

export function exportPermohonanPDF(rows) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(14);
  doc.text('Laporan Rekap Permohonan - Loket PLN ULP Agats', 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Waktu cetak: ${formatDate(new Date().toISOString())}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['No', 'ID', 'Tgl Input', 'Nama Pelanggan', 'Layanan', 'Daya', 'Status Terakhir', 'Total Biaya']],
    body: rows.map((p, i) => [
      i + 1,
      p.id,
      formatDateShort(p.date),
      p.nama,
      p.jenis,
      `${p.daya} VA`,
      p.status === 'Lunas'
        ? p.step === 6
          ? 'Selesai 100%'
          : `Lunas (Tahap ${p.step + 1})`
        : p.status,
      formatRp(p.biaya),
    ]),
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [27, 117, 187] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`Laporan_Permohonan_${Date.now()}.pdf`);
}

export function cetakStruk(p, trx) {
  const doc = new jsPDF('l', 'mm', 'a5');
  doc.setLineWidth(0.5);
  doc.rect(5, 5, 200, 138);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('KUITANSI PEMBAYARAN', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text('LOKET PLN ULP AGATS', 105, 22, { align: 'center' });

  doc.setLineWidth(0.2);
  doc.line(10, 26, 200, 26);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const y = 35;
  const lh = 8;
  const dateStr = trx ? formatDate(trx.date) : formatDate(p.date);

  const row = (label, value, i, bold = false) => {
    doc.text(label, 15, y + lh * i);
    doc.text(':', 55, y + lh * i);
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(String(value), 60, y + lh * i);
    if (bold) doc.setFont('helvetica', 'normal');
  };
  row('Telah terima dari', p.nama, 0, true);
  row('ID Permohonan', p.id, 1);
  row('Jenis Layanan', `${p.jenis} - ${p.daya} VA`, 2);
  row('Tanggal Pembayaran', dateStr, 3);
  row('Untuk Pembayaran', `Biaya ${p.jenis} a.n ${p.nama}`, 4);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y + lh * 6, 80, 12, 'F');
  doc.text(formatRp(p.biaya), 55, y + lh * 6 + 8, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const ttdY = y + lh * 6;
  doc.text('Agats, ' + dateStr.split(',')[0], 160, ttdY, { align: 'center' });
  doc.text('Petugas Loket', 160, ttdY + 5, { align: 'center' });
  doc.text('(_________________________)', 160, ttdY + 25, { align: 'center' });

  doc.save(`Kuitansi_${p.id}_${p.nama.replace(/\s+/g, '_')}.pdf`);
}
