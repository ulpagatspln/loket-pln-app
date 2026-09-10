import { state, calculateSaldo, gvBelumMasuk } from '../store.js';
import { formatRp, formatRpShort, formatDate, MONTHS, esc } from '../lib/format.js';
import { hargaTotalUntuk, danaNidiDiLoket, kekuranganBiaya, rincianDana } from '../lib/harga.js';
import { statCard, skeletonCards } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { goToPermohonan } from './permohonan.js';
import { openPermForm } from './permForm.js';

let chart;

const PIPE = [
  { step: 0, label: 'Belum Pembayaran PPOB', icon: 'fa-money-bill-transfer', color: 'border-pln-500' },
  { step: 1, label: 'Belum Pemasangan', icon: 'fa-helmet-safety', color: 'border-gold-500' },
  { step: 2, label: 'Belum Penginputan FSO', icon: 'fa-keyboard', color: 'border-purple-500' },
  { step: 3, label: 'Belum Peremajaan AP2T', icon: 'fa-server', color: 'border-pink-500' },
  { step: 4, label: 'Belum Bayar NIDI & SLO', icon: 'fa-money-check-dollar', color: 'border-teal-500' },
  { step: 5, label: 'Belum Upload Berkas NIDI', icon: 'fa-file-signature', color: 'border-leaf-500' },
];

export const dashboard = {
  el: null,
  build(el) {
    this.el = el;
    el.innerHTML = `
      <div class="mb-5">
        <h2 class="text-lg font-extrabold text-slate-900 dark:text-white md:text-xl">Dashboard</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Ringkasan kas dan monitoring progres permohonan.</p>
      </div>
      <div data-metrics class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"></div>
      <div class="mb-6 grid gap-4 lg:grid-cols-3">
        <div class="card p-4 lg:col-span-2">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Pemasukan 6 Bulan Terakhir</h3>
            <span class="badge badge-blue"><i class="fa-solid fa-chart-column"></i> Kas Masuk</span>
          </div>
          <div class="h-52"><canvas data-chart></canvas></div>
        </div>
        <div data-today class="card flex flex-col justify-center gap-3 p-4"></div>
      </div>
      <div class="mb-3 flex items-center gap-2">
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">
          <i class="fa-solid fa-layer-group text-pln-500"></i> Antrean Pekerjaan
        </h3>
        <span class="text-xs text-slate-400">Lunas &amp; belum dikerjakan</span>
      </div>
      <div data-pipeline class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>

      <div class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <i class="fa-solid fa-clipboard-list text-gold-500"></i> NOAGENDA Belum Masuk Permohonan
              <span data-gv-count class="badge badge-amber hidden"></span>
            </h3>
            <p data-gv-meta class="mt-0.5 text-xs text-slate-400">Belum ada data GV yang diimpor.</p>
          </div>
          <label class="btn btn-outline btn-sm shrink-0 cursor-pointer">
            <i class="fa-solid fa-file-import"></i> Import Data GV
            <input data-gv-file type="file" accept=".xls,.xlsx,application/vnd.ms-excel" class="hidden" />
          </label>
        </div>
        <div data-gv-list class="mt-3"></div>
      </div>
    `;
    el.querySelector('[data-metrics]').addEventListener('click', onCardClick);
    el.querySelector('[data-metrics]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') onCardClick(e);
    });
    el.querySelector('[data-pipeline]').addEventListener('click', onCardClick);
    el.querySelector('[data-gv-file]').addEventListener('change', (e) => this.onGvFile(e.target));
    const gvList = el.querySelector('[data-gv-list]');
    gvList.addEventListener('click', onCardClick);
    gvList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onCardClick(e);
      }
    });
  },
  refresh() {
    if (!this.el) return;
    if (!state.ready) {
      this.el.querySelector('[data-metrics]').innerHTML = skeletonCards(7);
      return;
    }
    const saldo = calculateSaldo();
    let waiting = 0, lunas = 0;
    let pb1Count = 0, pb1Nidi = 0;
    let nidiHoldCount = 0, nidiHoldTotal = 0;
    let kurangCount = 0, kurangTotal = 0;
    let noSavingCount = 0;
    const counts = [0, 0, 0, 0, 0, 0];
    for (const p of state.permohonan) {
      if (p.status === 'Menunggu Pembayaran') waiting++;
      if (p.status === 'Lunas' || p.status === 'Selesai') lunas++;
      if (p.status === 'Lunas' && p.step >= 0 && p.step < 6) counts[p.step]++;
      if (p.jenis === 'Pasang Baru' && Number(p.biaya) <= 1) {
        pb1Count++;
        const h = hargaTotalUntuk(p, state.harga, state.hargaTd);
        if (h) pb1Nidi += h.row.nidiSlo || 0;
      }
      const nidiHold = danaNidiDiLoket(p, state.kas, state.harga, state.hargaTd);
      if (nidiHold > 0) { nidiHoldCount++; nidiHoldTotal += nidiHold; }
      const kurang = kekuranganBiaya(p, state.harga, state.hargaTd);
      if (kurang > 0) { kurangCount++; kurangTotal += kurang; }

      const d = rincianDana(p, state.kas, state.harga, state.hargaTd);
      if (d && d.saving === 0) noSavingCount++;
    }

    this.el.querySelector('[data-metrics]').innerHTML = [
      statCard({ label: 'Total Saldo Kas', value: formatRp(saldo), icon: 'fa-wallet', tone: 'pln' }),
      statCard({ label: 'Menunggu Pembayaran', value: `${waiting} berkas`, icon: 'fa-clock', tone: 'gold', onClick: 'wait' }),
      statCard({ label: 'Permohonan Lunas', value: `${lunas} berkas`, icon: 'fa-file-circle-check', tone: 'leaf', onClick: 'lunas' }),
      statCard({
        label: 'Pasang Baru Biaya Rp 1',
        value: `${pb1Count} permohonan`,
        icon: 'fa-circle-exclamation',
        tone: 'red',
        sub: `NIDI+SLO: ${formatRp(pb1Nidi)}`,
        onClick: 'pb1',
      }),
      statCard({
        label: 'Dana NIDI+SLO di Loket',
        value: `${nidiHoldCount} permohonan`,
        icon: 'fa-file-invoice-dollar',
        tone: 'amber',
        sub: `Belum dibuat: ${formatRp(nidiHoldTotal)}`,
        onClick: 'nidihold',
      }),
      statCard({
        label: 'Permohonan Kurang Bayar',
        value: `${kurangCount} permohonan`,
        icon: 'fa-arrow-trend-down',
        tone: 'red',
        sub: `Total kurang: ${formatRp(kurangTotal)}`,
        onClick: 'kurang',
      }),
      statCard({
        label: 'Tanpa Saving Loket',
        value: `${noSavingCount} permohonan`,
        icon: 'fa-piggy-bank',
        tone: 'red',
        onClick: 'nosaving',
      }),
    ].join('');

    // Ringkasan hari ini
    const today = new Date().toDateString();
    const kasToday = state.kas.filter((k) => new Date(k.date).toDateString() === today);
    const masukToday = kasToday.filter((k) => k.tipe === 'Pemasukan').reduce((s, k) => s + k.nominal, 0);
    const permToday = state.permohonan.filter((p) => new Date(p.date).toDateString() === today).length;
    this.el.querySelector('[data-today]').innerHTML = `
      <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Hari Ini</p>
      <div class="flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-lg bg-leaf-500/15 text-leaf-600"><i class="fa-solid fa-arrow-down"></i></div>
        <div><p class="text-lg font-extrabold text-slate-900 dark:text-white">${formatRp(masukToday)}</p><p class="text-[11px] text-slate-400">Kas masuk</p></div>
      </div>
      <div class="flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-lg bg-pln-500/15 text-pln-600"><i class="fa-solid fa-file-signature"></i></div>
        <div><p class="text-lg font-extrabold text-slate-900 dark:text-white">${permToday}</p><p class="text-[11px] text-slate-400">Permohonan baru</p></div>
      </div>`;

    // Pipeline
    this.el.querySelector('[data-pipeline]').innerHTML = PIPE.map(
      (s) => `
      <div role="button" tabindex="0" data-action="step:${s.step}"
        class="card flex h-24 cursor-pointer flex-col justify-between border-l-4 ${s.color} p-3 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <p class="text-[11px] font-semibold leading-tight text-slate-600 dark:text-slate-300">${s.label}</p>
        <div class="flex items-end justify-between">
          <span class="text-2xl font-extrabold text-slate-900 dark:text-white">${counts[s.step]}</span>
          <i class="fa-solid ${s.icon} text-xl text-slate-200 dark:text-slate-700"></i>
        </div>
      </div>`
    ).join('');

    this.renderChart();
    this.renderGv();
  },

  renderGv() {
    const metaEl = this.el.querySelector('[data-gv-meta]');
    const countEl = this.el.querySelector('[data-gv-count]');
    const listEl = this.el.querySelector('[data-gv-list]');
    const m = state.gvMeta;

    if (m) {
      metaEl.textContent = `Import terakhir: ${formatDate(m.lastImportAt)} — file berisi ${m.rows} baris (${m.matched} cocok). Total dipantau: ${state.gvAgenda.length}.`;
    } else {
      metaEl.textContent = 'Belum ada data GV. Klik "Import Data GV" dan pilih file .xls dari aplikasi PLN.';
    }

    if (!state.gvAgenda.length) {
      countEl.classList.add('hidden');
      listEl.innerHTML = '';
      return;
    }

    const belum = gvBelumMasuk();
    countEl.textContent = String(belum.length);
    countEl.classList.toggle('hidden', belum.length === 0);

    if (!belum.length) {
      listEl.innerHTML = `<div class="rounded-lg bg-leaf-500/10 px-3 py-3 text-sm font-medium text-leaf-600 dark:text-leaf-400">
        <i class="fa-solid fa-circle-check"></i> Semua NOAGENDA dari GV sudah masuk di permohonan.</div>`;
      return;
    }

    listEl.innerHTML = `
      <p class="mb-2 text-[11px] text-slate-400"><i class="fa-solid fa-hand-pointer"></i> Klik salah satu untuk membuat permohonan dari datanya.</p>
      <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
        ${belum
          .map(
            (r) => `
          <div class="rounded-lg border border-slate-200 dark:border-slate-800">
            <div role="button" tabindex="0" data-action="new-from-gv:${esc(r.noAgenda)}"
              class="group cursor-pointer rounded-t-lg p-3 transition-colors hover:bg-pln-50 dark:hover:bg-pln-950/30">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">${esc(r.nama || '(tanpa nama)')}</p>
                  <p class="font-mono text-[11px] text-slate-400">${esc(r.noAgenda)}</p>
                </div>
                <div class="flex shrink-0 items-start gap-1">
                  <div class="flex flex-col items-end gap-1">
                    <span class="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><i class="fa-solid fa-${/MOBILE/i.test(r.asalMohon) ? 'mobile-screen-button' : 'store'}"></i> ${esc(r.asalMohon || '-')}</span>
                    <span class="badge bg-gold-500/15 text-gold-600 dark:text-gold-400">${esc(r.statusPermohonan || '-')}</span>
                  </div>
                  <button data-action="dismiss-gv:${esc(r.noAgenda)}" title="Hapus baris ini dari daftar"
                    class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-950/40">
                    <i class="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span><i class="fa-regular fa-calendar mr-1"></i>${esc(String(r.tglMohon).split(' ')[0] || '-')}</span>
                <span>${esc(r.jenis || '-')}</span>
                <span>${esc(r.daya || '-')} VA</span>
                <span class="font-semibold text-slate-700 dark:text-slate-300">${formatRp(r.biaya)}</span>
                <span class="ml-auto font-semibold text-pln-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-pln-400">Buat permohonan <i class="fa-solid fa-arrow-right"></i></span>
              </div>
            </div>
            ${
              r.namaMatch
                ? `<button data-action="open-perm:${esc(r.namaMatch.id)}" class="block w-full rounded-b-lg border-t border-amber-200 bg-amber-100 px-3 py-1.5 text-left text-[11px] font-medium text-amber-700 hover:bg-amber-200 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                     <i class="fa-solid fa-triangle-exclamation"></i> Nama sama dengan ${esc(r.namaMatch.id)}${r.namaMatch.noAgenda ? ` (agenda ${esc(r.namaMatch.noAgenda)})` : ''} — mungkin salah ketik agenda, cek dulu.
                   </button>`
                : ''
            }
          </div>`
          )
          .join('')}
      </div>`;
  },

  async onGvFile(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    toast('Membaca file GV...', 'info');
    let rows;
    try {
      const { parseGvFile } = await import('../lib/gvImport.js');
      rows = await parseGvFile(file);
    } catch (err) {
      console.error(err);
      return toast(err.message || 'Gagal membaca file.', 'error');
    }
    const matched = rows.filter((r) => this._permAgendas().has(r.noAgenda)).length;
    confirmDialog({
      title: 'Import Data GV',
      message: `${rows.length} baris terbaca, ${matched} cocok dengan permohonan. Mode gabung: data dari import sebelumnya tidak dihapus, hanya ditambah/diperbarui. Lanjutkan?`,
      confirmText: 'Ya, Import',
      tone: 'primary',
      icon: 'fa-file-import',
      onConfirm: async () => {
        const { importGv } = await import('../lib/gvImport.js');
        const res = await importGv(rows, file.name);
        toast(
          `Import selesai: ${res.rows} baris (${res.baru} baru), ${res.enriched} permohonan diperbarui.`,
          'success'
        );
      },
    });
  },

  _permAgendas() {
    return new Set(state.permohonan.filter((p) => p.noAgenda).map((p) => String(p.noAgenda).trim()));
  },

  renderChart() {
    const canvas = this.el.querySelector('[data-chart]');
    if (!canvas || !window.Chart) return;
    const now = new Date();
    const labels = [];
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(MONTHS[d.getMonth()].slice(0, 3));
      buckets.push(
        state.kas
          .filter((k) => {
            const kd = new Date(k.date);
            return k.tipe === 'Pemasukan' && kd.getMonth() === d.getMonth() && kd.getFullYear() === d.getFullYear();
          })
          .reduce((s, k) => s + k.nominal, 0)
      );
    }
    const dark = document.documentElement.classList.contains('dark');
    if (chart) chart.destroy();
    chart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: buckets,
            backgroundColor: '#1B75BB',
            borderRadius: 6,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => formatRp(c.raw) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: dark ? '#94a3b8' : '#64748b' } },
          y: {
            grid: { color: dark ? '#1e293b' : '#e2e8f0' },
            ticks: { color: dark ? '#94a3b8' : '#64748b', callback: (v) => formatRpShort(v) },
          },
        },
      },
    });
  },
};

function onCardClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'wait') goToPermohonan({ status: 'Menunggu Pembayaran' });
  else if (a === 'lunas') goToPermohonan({ status: 'Lunas' });
  else if (a === 'pb1') goToPermohonan({ biaya1: true });
  else if (a === 'nidihold') goToPermohonan({ nidiHold: true });
  else if (a === 'kurang') goToPermohonan({ kurang: true });
  else if (a === 'nosaving') goToPermohonan({ noSaving: true });
  else if (a.startsWith('step:')) goToPermohonan({ status: 'Lunas', step: a.split(':')[1] });
  else if (a.startsWith('open-perm:')) goToPermohonan({ q: a.split(':')[1] });
  else if (a.startsWith('new-from-gv:')) {
    const noAgenda = a.slice('new-from-gv:'.length);
    const row = state.gvAgenda.find((r) => String(r.noAgenda) === noAgenda);
    if (row) openPermForm(null, row);
  } else if (a.startsWith('dismiss-gv:')) {
    const noAgenda = a.slice('dismiss-gv:'.length);
    const row = state.gvAgenda.find((r) => String(r.noAgenda) === noAgenda);
    confirmDialog({
      title: 'Hapus dari daftar',
      message: `Hapus agenda ${noAgenda}${row?.nama ? ` (${row.nama})` : ''} dari daftar pantau? Gunakan ini kalau agenda dibatalkan atau salah. Akan muncul lagi kalau ada di import GV berikutnya.`,
      confirmText: 'Ya, Hapus',
      onConfirm: async () => {
        const { deleteGvRow } = await import('../lib/gvImport.js');
        await deleteGvRow(noAgenda);
        toast('Baris dihapus dari daftar.');
      },
    });
  }
}
