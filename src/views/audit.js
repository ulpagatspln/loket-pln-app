import { state } from '../store.js';
import { buildAudit } from '../lib/audit.js';
import { formatRp, formatDateShort, esc } from '../lib/format.js';
import { toast } from '../ui/toast.js';

// Tanggal lokal (toISOString memakai UTC, bisa mundur sehari di WIT).
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();

let range = {
  from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
  to: iso(now),
};
let laporan = null;

const PRESET = [
  { key: 'bulan-ini', label: 'Bulan ini' },
  { key: 'bulan-lalu', label: 'Bulan lalu' },
  { key: '3-bulan', label: '3 bulan terakhir' },
  { key: 'tahun-ini', label: 'Tahun ini' },
  { key: 'semua', label: 'Semua data' },
];

function applyPreset(key) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === 'bulan-ini') range = { from: iso(new Date(y, m, 1)), to: iso(now) };
  else if (key === 'bulan-lalu') range = { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  else if (key === '3-bulan') range = { from: iso(new Date(y, m - 2, 1)), to: iso(now) };
  else if (key === 'tahun-ini') range = { from: iso(new Date(y, 0, 1)), to: iso(now) };
  else if (key === 'semua') {
    const tgl = [...state.permohonan, ...state.kas].map((x) => new Date(x.date)).filter((d) => !isNaN(d));
    const min = tgl.length ? new Date(Math.min(...tgl)) : new Date(y, 0, 1);
    range = { from: iso(min), to: iso(now) };
  }
}

/* ===== potongan tampilan ===== */
const stat = (label, nilai, sub = '', tone = 'pln') => `
  <div class="card p-3.5">
    <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">${label}</p>
    <p class="mt-0.5 text-lg font-extrabold tabular-nums text-${tone}-600 dark:text-${tone}-300">${nilai}</p>
    ${sub ? `<p class="mt-0.5 text-[10px] text-slate-400">${sub}</p>` : ''}
  </div>`;

const baris = (label, nilai, opt = {}) => `
  <div class="flex items-center justify-between gap-3 py-1.5 ${opt.garis ? 'border-t border-slate-100 dark:border-slate-800' : ''}">
    <span class="text-xs ${opt.tebal ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}">${label}</span>
    <span class="tabular-nums text-xs ${opt.tebal ? 'font-extrabold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'} ${opt.cls || ''}">${nilai}</span>
  </div>`;

const panel = (judul, isi, sub = '') => `
  <div class="card p-4">
    <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">${judul}</h3>
    ${sub ? `<p class="mb-2 text-[11px] text-slate-400">${sub}</p>` : '<div class="mb-1"></div>'}
    ${isi}
  </div>`;

const tabelMini = (head, rows) => `
  <div class="-mx-1 overflow-x-auto">
    <table class="w-full text-left text-xs">
      <thead>
        <tr class="text-[10px] uppercase tracking-wide text-slate-400">
          ${head.map((h, i) => `<th class="px-1 pb-1 font-semibold ${i ? 'text-right' : ''}">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        ${rows
          .map(
            (r) => `<tr>${r
              .map((c, i) => `<td class="px-1 py-1.5 ${i ? 'text-right tabular-nums' : 'text-slate-600 dark:text-slate-300'}">${c}</td>`)
              .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>`;

const TEMUAN_TONE = {
  bahaya: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300',
  peringatan: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  info: 'border-pln-500/30 bg-pln-500/10 text-pln-600 dark:text-pln-300',
};

const NIDI_LABEL = {
  titip: 'Titip NIDI+SLO',
  tidak_titip: 'Tidak ada titip NIDI+SLO',
  tidak_perlu: 'Tidak perlu NIDI+SLO',
  dibayar: 'Sudah dibayar loket',
  kosong: 'Belum ditandai',
};

export const audit = {
  el: null,
  build(el) {
    this.el = el;
    el.innerHTML = `
      <div class="mb-4">
        <h2 class="text-lg font-extrabold text-slate-900 dark:text-white md:text-xl">Audit</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Laporan pemeriksaan alur dana loket untuk periode tertentu.</p>
      </div>

      <div class="card mb-5 p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="field-label">Dari tanggal</label>
            <input data-from type="date" class="input w-44" />
          </div>
          <div>
            <label class="field-label">Sampai tanggal</label>
            <input data-to type="date" class="input w-44" />
          </div>
          <button data-run class="btn btn-primary"><i class="fa-solid fa-magnifying-glass-chart"></i> Proses Audit</button>
          <button data-pdf class="btn btn-outline" disabled><i class="fa-solid fa-file-pdf"></i> Unduh PDF</button>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          ${PRESET.map((p) => `<button data-preset="${p.key}" class="badge badge-blue hover:brightness-110">${p.label}</button>`).join('')}
        </div>
      </div>

      <div data-hasil></div>`;

    el.querySelector('[data-run]').addEventListener('click', () => this.jalankan());
    el.querySelector('[data-pdf]').addEventListener('click', () => this.unduhPdf());
    el.querySelectorAll('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        applyPreset(b.dataset.preset);
        this.syncControls();
        this.jalankan();
      })
    );
    ['from', 'to'].forEach((k) =>
      el.querySelector(`[data-${k}]`).addEventListener('change', (e) => {
        range[k] = e.target.value;
      })
    );
    this.syncControls();
  },

  syncControls() {
    if (!this.el) return;
    this.el.querySelector('[data-from]').value = range.from;
    this.el.querySelector('[data-to]').value = range.to;
  },

  jalankan() {
    if (!state.ready) return toast('Data belum selesai dimuat.', 'error');
    if (range.from > range.to) return toast('Tanggal awal melebihi tanggal akhir.', 'error');
    laporan = buildAudit(range);
    this.el.querySelector('[data-pdf]').disabled = false;
    this.render();
  },

  async unduhPdf() {
    if (!laporan) return;
    toast('Menyiapkan PDF...', 'info');
    const { exportAuditPDF } = await import('../lib/auditPdf.js');
    exportAuditPDF(laporan);
  },

  refresh() {
    if (!this.el) return;
    if (laporan) this.jalankan();
  },

  render() {
    const r = laporan;
    const k = r.kas;
    const m = r.permohonan.masuk;
    const host = this.el.querySelector('[data-hasil]');
    const pb = (s) => `PB ${s.pb} · TD ${s.td}`;

    host.innerHTML = `
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        ${stat('Permohonan masuk', `${m.count}`, pb(m), 'pln')}
        ${stat('Nilai dibayar pelanggan', formatRp(m.rp), `${k.masuk.count} transaksi kas masuk`, 'pln')}
        ${stat('Saving loket dihasilkan', formatRp(r.saving.ada.rp), `${r.saving.ada.count} permohonan · ${pb(r.saving.ada)}`, 'leaf')}
        ${stat('Tanpa saving loket', `${r.saving.tanpa.count}`, pb(r.saving.tanpa), 'red')}
      </div>

      <div class="mb-4 grid gap-4 lg:grid-cols-2">
        ${panel(
          'Arus Kas Periode',
          baris('Saldo awal', formatRp(k.saldoAwal), { tebal: true }) +
            baris('Masuk — pembayaran pelanggan', formatRp(k.masuk.pelanggan)) +
            baris('Masuk — tambah saldo (gabungan)', formatRp(k.masuk.manualGabungan)) +
            baris('Masuk — tambah saldo (safe deposit)', formatRp(k.masuk.manualSafe)) +
            baris('Total masuk', formatRp(k.masuk.total), { tebal: true, garis: true, cls: 'text-leaf-600 dark:text-leaf-400' }) +
            baris('Keluar — BP di PPOB', '−' + formatRp(k.keluar.ppob)) +
            baris('Keluar — jasa pemasangan', '−' + formatRp(k.keluar.pasang)) +
            baris('Keluar — NIDI & SLO', '−' + formatRp(k.keluar.nidi)) +
            baris('Keluar — lainnya', '−' + formatRp(k.keluar.lain)) +
            baris('Total keluar (biaya proyek)', '−' + formatRp(k.keluar.total), { tebal: true, garis: true, cls: 'text-red-500' }) +
            baris('Penarikan kas (operasional)', '−' + formatRp(k.tarik.total), { tebal: true, cls: 'text-amber-500' }) +
            baris('Saldo akhir periode', formatRp(k.saldoAkhir), { tebal: true, garis: true }),
          'Uang masuk, dipakai untuk apa saja, dan sisa akhir'
        )}
        ${panel(
          'Posisi Kas Saat Ini',
          baris('Total saldo kas', formatRp(r.posisi.saldoKini), { tebal: true }) +
            baris('Titipan NIDI+SLO belum disetor', '−' + formatRp(r.posisi.titipanAktif)) +
            baris('Safe deposit', '−' + formatRp(r.posisi.safeKini)) +
            baris('Kas yang dapat digunakan', formatRp(r.posisi.kasDapatDigunakan), {
              tebal: true,
              garis: true,
              cls: r.posisi.kasDapatDigunakan < 0 ? 'text-red-500' : 'text-leaf-600 dark:text-leaf-400',
            }) +
            `<div class="mt-3">${tabelMini(
              ['Penarikan per kategori', 'Transaksi', 'Nominal'],
              k.tarik.perKategori.length
                ? k.tarik.perKategori.map((c) => [esc(c.label), c.count, formatRp(c.total)])
                : [['Tidak ada penarikan pada periode ini', '-', '-']]
            )}</div>`,
          'Komposisi saldo pada saat ini (lintas periode)'
        )}
      </div>

      <div class="mb-4 grid gap-4 lg:grid-cols-2">
        ${panel(
          'Penanda NIDI+SLO',
          tabelMini(
            ['Penanda', 'PB', 'TD', 'Nilai'],
            Object.keys(NIDI_LABEL).map((key) => {
              const s = r.nidi[key];
              return [NIDI_LABEL[key], s.pb, s.td, formatRp(s.rp)];
            })
          ),
          'Jumlah permohonan & nilai NIDI+SLO per penanda'
        )}
        ${panel(
          'Biaya vs Daftar Harga',
          tabelMini(
            ['Hasil', 'PB', 'TD', 'Selisih'],
            [
              ['Kurang', r.harga.kurang.pb, r.harga.kurang.td, '−' + formatRp(r.harga.kurang.rp)],
              ['Sesuai', r.harga.pas.pb, r.harga.pas.td, '-'],
              ['Lebih', r.harga.lebih.pb, r.harga.lebih.td, '+' + formatRp(r.harga.lebih.rp)],
              ['Tidak ada di daftar', r.harga.takAda.pb, r.harga.takAda.td, '-'],
            ]
          ),
          'Perbandingan total biaya pelanggan dengan daftar harga'
        )}
      </div>

      ${panel(
        '<i class="fa-solid fa-clipboard-check text-gold-500"></i> Catatan & Temuan Audit',
        `<div class="space-y-2">${r.temuan
          .map(
            (t) => `<div class="rounded-xl border px-3 py-2 text-xs leading-snug ${TEMUAN_TONE[t.level]}">
              <i class="fa-solid ${t.level === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation'} mr-1"></i>${esc(t.teks)}
            </div>`
          )
          .join('')}</div>`,
        `${r.temuan.length} catatan untuk periode ini`
      )}

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        ${panel(
          'Lampiran A — Pasang Baru tanpa saving loket',
          tabelMini(
            ['Pelanggan', 'Tanggal', 'Dibayar', 'Sisa'],
            r.lampiran.pbTanpaSaving.length
              ? r.lampiran.pbTanpaSaving
                  .slice(0, 12)
                  .map(({ p, d }) => [`${esc(p.nama)} <span class="text-slate-400">(${p.id})</span>`, formatDateShort(p.date), formatRp(p.biaya), formatRp(d.sisa)])
              : [['Tidak ada', '-', '-', '-']]
          ) + (r.lampiran.pbTanpaSaving.length > 12 ? `<p class="mt-2 text-[10px] text-slate-400">+${r.lampiran.pbTanpaSaving.length - 12} lainnya — lihat PDF</p>` : ''),
          `${r.lampiran.pbTanpaSaving.length} permohonan`
        )}
        ${panel(
          'Lampiran B — Tidak ada titipan NIDI+SLO',
          tabelMini(
            ['Pelanggan', 'Layanan', 'Nilai NIDI+SLO'],
            r.lampiran.tanpaTitip.length
              ? r.lampiran.tanpaTitip
                  .slice(0, 12)
                  .map(({ p, nidiSlo }) => [`${esc(p.nama)} <span class="text-slate-400">(${p.id})</span>`, `${esc(p.jenis)} ${p.daya} VA`, formatRp(nidiSlo)])
              : [['Tidak ada', '-', '-']]
          ) + (r.lampiran.tanpaTitip.length > 12 ? `<p class="mt-2 text-[10px] text-slate-400">+${r.lampiran.tanpaTitip.length - 12} lainnya — lihat PDF</p>` : ''),
          `${r.lampiran.tanpaTitip.length} permohonan · total ${formatRp(r.nidi.tidak_titip.rp)}`
        )}
      </div>

      <p class="mt-4 text-center text-[11px] text-slate-400">
        <i class="fa-solid fa-file-pdf"></i> Lampiran lengkap (termasuk daftar penarikan kas & NOAGENDA belum masuk) tersedia di laporan PDF.
      </p>`;
  },
};
