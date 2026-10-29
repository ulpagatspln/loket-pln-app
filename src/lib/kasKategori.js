/**
 * Kategori peruntukan penarikan kas — dicocokkan dari kata kunci di keterangan.
 * Urutan = prioritas (yang pertama cocok dipakai). Dipakai dashboard & laporan audit.
 */
export const KAS_KATEGORI = [
  { key: 'sosial', label: 'Sosial & Kedukaan', icon: 'fa-heart', bar: 'bg-pink-500', rgb: [236, 72, 153], test: /karangan bunga|sumbangan|duka|ultah/i },
  { key: 'air', label: 'Air Kantor', icon: 'fa-droplet', bar: 'bg-sky-500', rgb: [14, 165, 233], test: /\bblong\b|air kantor|filter air/i },
  { key: 'konsumsi', label: 'Konsumsi & Jamuan Tamu', icon: 'fa-mug-hot', bar: 'bg-amber-500', rgb: [245, 158, 11], test: /makan|minum|snack|kopi|kue|tamu|\bteh\b|aqua|nasi|tumpeng|roti|es buah|tissu|tisu/i },
  { key: 'lapangan', label: 'Pekerjaan Lapangan', icon: 'fa-screwdriver-wrench', bar: 'bg-purple-500', rgb: [168, 85, 247], test: /grounding|pemerataan beban|\bkabel\b|\bviar\b|bensin|\bsolar\b|pengerjaan/i },
  { key: 'admin', label: 'Operasional & Administrasi', icon: 'fa-building', bar: 'bg-slate-400', rgb: [148, 163, 184], test: /materai|hosting|top ?up|ongkir|ongkos kirim|\bpanel\b|retribusi|akrilik|beli tanah/i },
  { key: 'lain', label: 'Lainnya', icon: 'fa-ellipsis', bar: 'bg-slate-300 dark:bg-slate-600', rgb: [203, 213, 225], test: null },
];

export const kategoriTarik = (ket) =>
  KAS_KATEGORI.find((c) => c.test?.test(ket || '')) || KAS_KATEGORI[KAS_KATEGORI.length - 1];
