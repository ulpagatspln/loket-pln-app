export const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export const formatRpShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return 'Rp ' + (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + ' jt';
  if (Math.abs(v) >= 1_000) return 'Rp ' + Math.round(v / 1_000) + ' rb';
  return 'Rp ' + v;
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export const generateId = (prefix) => prefix + '-' + Math.floor(1000 + Math.random() * 9000);

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Escape untuk mencegah HTML injection saat merender data ke innerHTML
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

// Parsing input angka yang mungkin diformat (1.000.000 / 1,000,000)
export const parseNum = (v) => {
  if (typeof v === 'number') return v;
  return parseInt(String(v || '').replace(/[^\d-]/g, ''), 10) || 0;
};
