import { state, deletePermohonan, prosesBayar } from '../store.js';
import { PROGRESS_STEPS } from '../store.js';
import { formatRp, formatDate, formatDateShort, MONTHS, esc, parseNum } from '../lib/format.js';
import { emptyState, skeletonRows, filterChip, bindRupiahInputs } from '../ui/components.js';
import { openModal, confirmDialog, openImageViewer } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { requireAdmin } from '../ui/adminGate.js';
import { openPermForm } from './permForm.js';
import { openProgressModal } from './progress.js';
import { exportPermohonanPDF, cetakStruk } from '../lib/pdf.js';
import { getPhoto } from '../lib/imageStore.js';
import {
  hargaTotalUntuk, rincianDana,
} from '../lib/harga.js';
import { nidiTandaChip, openNidiTandaPicker, NIDI_TANDA } from '../ui/nidiTanda.js';

const PER_PAGE = 10;
const now = new Date();
let page = 1;
let filters = {
  q: '',
  month: String(now.getMonth()),
  year: String(now.getFullYear()),
  jenis: 'All',
  status: 'All',
  step: 'All',
  nidiTanda: 'All', // 'titip' | 'tidak_titip' | 'tidak_perlu' | 'dibayar' | 'kosong' | 'All'
  saving: 'All', // 'ada' | 'tanpa' | 'All'
  biaya: 'All', // 'kurang' (total biaya < total daftar harga) | 'All'
};

export function goToPermohonan(overrides = {}) {
  filters = {
    q: '', month: 'All', year: 'All', jenis: 'All', status: 'All', step: 'All',
    nidiTanda: 'All', saving: 'All', biaya: 'All', ...overrides,
  };
  page = 1;
  window.dispatchEvent(new CustomEvent('navigate', { detail: 'permohonan' }));
  permohonan.syncControls?.();
  permohonan.refresh();
}

function getFiltered() {
  const q = filters.q.toLowerCase();
  return state.permohonan
    .filter((p) => {
      const d = new Date(p.date);
      const matchQ =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.nama.toLowerCase().includes(q) ||
        p.jenis.toLowerCase().includes(q) ||
        (p.noAgenda && p.noAgenda.toLowerCase().includes(q)) ||
        (p.namaPemasang && p.namaPemasang.toLowerCase().includes(q));
      const matchStatus = filters.status === 'All' || p.status === filters.status;
      const matchStep = filters.step === 'All' || (p.status === 'Lunas' && p.step == filters.step);
      const matchMonth = filters.month === 'All' || d.getMonth() === +filters.month;
      const matchYear = filters.year === 'All' || d.getFullYear() === +filters.year;
      const matchJenis = filters.jenis === 'All' || p.jenis === filters.jenis;
      const matchNidiTanda =
        filters.nidiTanda === 'All' ||
        (filters.nidiTanda === 'kosong' ? !p.nidiTanda : p.nidiTanda === filters.nidiTanda);
      const matchSaving = (() => {
        if (filters.saving === 'All') return true;
        const dd = rincianDana(p, state.kas, state.harga, state.hargaTd);
        if (!dd) return false;
        return filters.saving === 'ada' ? dd.saving > 0 : dd.saving <= 0;
      })();
      const matchBiaya = (() => {
        if (filters.biaya === 'All') return true;
        const h = hargaTotalUntuk(p, state.harga, state.hargaTd);
        if (!h) return false;
        return Number(p.biaya || 0) < h.total;
      })();
      return (
        matchQ && matchStatus && matchStep && matchMonth && matchYear && matchJenis &&
        matchNidiTanda && matchSaving && matchBiaya
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Penanda biaya vs daftar harga: KURANG / PAS / LEBIH
const marker = (p) => {
  const h = hargaTotalUntuk(p, state.harga, state.hargaTd);
  if (!h) return '';
  const selisih = Number(p.biaya || 0) - h.total;
  const tip = `Daftar harga ${h.kind} ${h.rt ? 'RT' : 'Selain RT'}: ${formatRp(h.total)}`;
  let badge;
  if (selisih === 0)
    badge = `<span title="${tip}" class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Pas daftar harga</span>`;
  else if (selisih < 0)
    badge = `<span title="${tip}" class="badge bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"><i class="fa-solid fa-arrow-down"></i> Kurang ${formatRp(-selisih)}</span>`;
  else
    badge = `<span title="${tip}" class="badge bg-pln-500/15 text-pln-700 dark:text-pln-300"><i class="fa-solid fa-arrow-up"></i> Lebih ${formatRp(selisih)}</span>`;
  return `<div class="mt-1">${badge}</div>`;
};

// Ringkasan dana loket ringkas (sisa · alokasi belum dibayar · saving)
const rp = (n) => (n < 0 ? '−' + formatRp(-n) : formatRp(n));
const rincianMini = (p) => {
  const d = rincianDana(p, state.kas, state.harga, state.hargaTd);
  if (!d) return '';
  const ln = (label, val, cls = '') =>
    `<div class="flex justify-between gap-2"><span class="whitespace-nowrap">${label}</span><span class="tabular-nums whitespace-nowrap ${cls}">${val}</span></div>`;
  let rows = ln('Sisa di loket', rp(d.sisa), 'font-semibold text-slate-700 dark:text-slate-200');
  if (d.alokNidi) rows += ln('− NIDI+SLO', '−' + formatRp(d.alokNidi), 'text-amber-600 dark:text-amber-400');
  if (d.alokJasa) rows += ln('− Jasa pasang', '−' + formatRp(d.alokJasa), 'text-amber-600 dark:text-amber-400');
  rows += ln(
    'Saving loket',
    d.saving > 0 ? formatRp(d.saving) : 'Rp 0 (tidak ada)',
    'font-bold ' + (d.saving > 0 ? 'text-leaf-700 dark:text-leaf-400' : 'text-slate-400')
  );
  return `<div class="mt-1.5 min-w-[170px] space-y-0.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">${rows}</div>`;
};

function gvBadges(p, cls = 'mt-1.5') {
  if (!p.asalMohon && !p.statusPermohonan) return '';
  const b = [];
  if (p.asalMohon)
    b.push(
      `<span class="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><i class="fa-solid fa-${
        /MOBILE/i.test(p.asalMohon) ? 'mobile-screen-button' : 'store'
      }"></i> ${esc(p.asalMohon)}</span>`
    );
  if (p.statusPermohonan)
    b.push(`<span class="badge bg-gold-500/15 text-gold-600 dark:text-gold-400">${esc(p.statusPermohonan)}</span>`);
  return `<div class="${cls} flex flex-wrap gap-1">${b.join('')}</div>`;
}

function statusBadge(p) {
  if (p.status === 'Menunggu Pembayaran') return `<span class="badge badge-amber">Menunggu Pembayaran</span>`;
  if (p.status === 'Selesai')
    return `<span class="badge badge-teal">Selesai 100%</span>
      <span class="mt-1 block text-[11px] font-medium text-teal-600 dark:text-teal-400">Semua tahap selesai</span>`;
  if (p.status === 'Lunas')
    return `<span class="badge badge-green">Lunas</span>
      <span class="mt-1 block text-[11px] font-medium text-pln-600 dark:text-pln-400">
        Tahap ${p.step === 6 ? 6 : p.step + 1}/6 · ${PROGRESS_STEPS[p.step] || 'Selesai'}</span>`;
  return '';
}

function infoPengerjaan(p) {
  const parts = [];
  if (p.noAgenda) parts.push(`<span><i class="fa-solid fa-hashtag mr-1 text-slate-400"></i>Agenda: <b class="text-slate-900 dark:text-white">${esc(p.noAgenda)}</b></span>`);
  if (p.namaPemasang) parts.push(`<span><i class="fa-solid fa-hard-hat mr-1 text-slate-400"></i>Pemasang: <b class="text-slate-900 dark:text-white">${esc(p.namaPemasang)}</b></span>`);
  const trx = (m) => state.kas.find((k) => k.refId === p.id && k.ket.includes(m));
  const ppob = trx('PPOB'), pas = trx('Pemasangan'), nidi = trx('NIDI');
  const foto = (t, label) =>
    t?.buktiId
      ? ` <button data-act="foto" data-bukti="${esc(t.buktiId)}" data-caption="${esc(label + ' - ' + p.nama)}" class="ml-1 align-middle text-pln-500 hover:text-pln-600" title="Lihat foto bukti"><i class="fa-solid fa-image"></i></button>`
      : t?.link
      ? ` <a href="${esc(t.link)}" target="_blank" rel="noopener" class="ml-1 align-middle text-slate-400 hover:text-slate-600" title="Bukti GDrive (lama)"><i class="fa-solid fa-link"></i></a>`
      : '';
  if (ppob) parts.push(`<span class="text-red-600 dark:text-red-400"><i class="fa-solid fa-money-bill-transfer mr-1"></i>PPOB: <b>${formatRp(ppob.nominal)}</b>${foto(ppob, 'Bukti PPOB')}</span>`);
  if (pas) parts.push(`<span class="text-red-600 dark:text-red-400"><i class="fa-solid fa-helmet-safety mr-1"></i>Pasang: <b>${formatRp(pas.nominal)}</b>${foto(pas, 'Bukti Pemasangan')}</span>`);
  if (nidi) parts.push(`<span class="text-red-600 dark:text-red-400"><i class="fa-solid fa-file-signature mr-1"></i>NIDI/SLO: <b>${formatRp(nidi.nominal)}</b></span>`);
  if (!parts.length) return `<span class="text-xs italic text-slate-400">Belum ada info</span>`;
  return `<div class="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-400">${parts.join('')}</div>`;
}

function rowActions(p) {
  const isLunas = p.status === 'Lunas' || p.status === 'Selesai';
  const primary =
    p.status === 'Menunggu Pembayaran'
      ? `<button data-act="bayar" data-id="${p.id}" class="btn btn-primary btn-sm w-full">Bayar</button>`
      : `<button data-act="progres" data-id="${p.id}" class="btn btn-outline btn-sm w-full text-pln-600 dark:text-pln-400">Progres</button>`;
  return `
    ${primary}
    <div class="mt-1.5 flex justify-center gap-1">
      ${isLunas ? `<button data-act="struk" data-id="${p.id}" title="Cetak kuitansi" class="btn-icon bg-leaf-500/15 text-leaf-600"><i class="fa-solid fa-print"></i></button>` : ''}
      <button data-act="edit" data-id="${p.id}" title="Edit" class="btn-icon btn-ghost"><i class="fa-solid fa-pen"></i></button>
      <button data-act="hapus" data-id="${p.id}" title="Hapus" class="btn-icon bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"><i class="fa-solid fa-trash"></i></button>
      <button data-act="wa" data-id="${p.id}" title="Salin data" class="btn-icon bg-pln-500/10 text-pln-600 dark:text-pln-400"><i class="fa-solid fa-copy"></i></button>
    </div>`;
}

export const permohonan = {
  el: null,
  build(el) {
    this.el = el;
    el.innerHTML = `
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900 dark:text-white md:text-xl">Permohonan &amp; Loket</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Daftar pelanggan dan proses pembayaran.</p>
        </div>
        <button data-add class="btn btn-primary sm:w-auto"><i class="fa-solid fa-plus"></i> Tambah Permohonan</button>
      </div>

      <div class="card mb-4 p-3">
        <div class="flex flex-col gap-2 sm:flex-row">
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input data-q class="input pl-10" placeholder="Cari ID, nama, agenda, pemasang..." />
          </div>
          <button data-toggle-filter class="btn btn-ghost sm:w-auto"><i class="fa-solid fa-sliders"></i> Filter</button>
          <button data-pdf class="btn btn-danger-ghost sm:w-auto"><i class="fa-solid fa-file-pdf"></i> Export PDF</button>
        </div>
        <div data-filter-panel class="mt-3 hidden grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <select data-f="month" class="select">
            <option value="All">Semua Bulan</option>
            ${MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('')}
          </select>
          <select data-f="year" class="select"></select>
          <select data-f="jenis" class="select">
            <option value="All">Semua Layanan</option>
            <option value="Pasang Baru">Pasang Baru</option>
            <option value="Tambah Daya">Tambah Daya</option>
          </select>
          <select data-f="status" class="select">
            <option value="All">Semua Status</option>
            <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
            <option value="Lunas">Lunas</option>
            <option value="Selesai">Selesai</option>
          </select>
          <select data-f="step" class="select">
            <option value="All">Semua Tahap</option>
            ${PROGRESS_STEPS.map((s, i) => `<option value="${i}">Tahap ${i + 1}: ${s}</option>`).join('')}
          </select>
        </div>
        <div data-chips class="mt-2 flex flex-wrap gap-1.5 empty:hidden"></div>
      </div>

      <div data-results></div>

      <div data-pager class="mt-4 hidden items-center justify-between">
        <span data-page-info class="text-xs text-slate-500 dark:text-slate-400"></span>
        <div class="flex gap-1">
          <button data-prev class="btn btn-outline btn-sm"><i class="fa-solid fa-chevron-left"></i></button>
          <button data-next class="btn btn-outline btn-sm"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>`;

    el.querySelector('[data-add]').addEventListener('click', () => openPermForm());
    el.querySelector('[data-pdf]').addEventListener('click', () => {
      const rows = getFiltered();
      if (!rows.length) return toast('Tidak ada data untuk diexport.', 'error');
      exportPermohonanPDF(rows);
      toast('Laporan PDF berhasil diunduh.');
    });
    el.querySelector('[data-toggle-filter]').addEventListener('click', () => {
      const pnl = el.querySelector('[data-filter-panel]');
      pnl.classList.toggle('hidden');
      pnl.classList.toggle('grid');
    });

    const q = el.querySelector('[data-q]');
    q.addEventListener('input', () => { filters.q = q.value; page = 1; this.refresh(); });
    el.querySelectorAll('[data-f]').forEach((sel) => {
      sel.addEventListener('change', () => { filters[sel.dataset.f] = sel.value; page = 1; this.refresh(); });
    });
    el.querySelector('[data-chips]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-clear-filter]');
      if (!b) return;
      const k = b.dataset.clearFilter;
      filters[k] = k === 'q' ? '' : 'All';
      page = 1;
      this.syncControls();
      this.refresh();
    });
    el.querySelector('[data-prev]').addEventListener('click', () => { page--; this.refresh(); });
    el.querySelector('[data-next]').addEventListener('click', () => { page++; this.refresh(); });

    el.querySelector('[data-results]').addEventListener('click', onAction);
    this.syncControls();
  },

  syncControls() {
    if (!this.el) return;
    this.el.querySelector('[data-q]').value = filters.q;
    const years = new Set(state.permohonan.map((p) => new Date(p.date).getFullYear()));
    years.add(now.getFullYear());
    const ysel = this.el.querySelector('[data-f="year"]');
    ysel.innerHTML = `<option value="All">Semua Tahun</option>` +
      [...years].sort().reverse().map((y) => `<option value="${y}">${y}</option>`).join('');
    ['month', 'year', 'jenis', 'status', 'step'].forEach((k) => {
      const s = this.el.querySelector(`[data-f="${k}"]`);
      if (s) s.value = filters[k];
    });
  },

  refresh() {
    if (!this.el) return;
    const wrap = this.el.querySelector('[data-results]');
    const chips = this.el.querySelector('[data-chips]');
    const pager = this.el.querySelector('[data-pager]');

    // chips
    const c = [];
    if (filters.q) c.push(filterChip(`"${filters.q}"`, 'q'));
    if (filters.month !== 'All') c.push(filterChip(MONTHS[+filters.month], 'month'));
    if (filters.year !== 'All') c.push(filterChip(filters.year, 'year'));
    if (filters.jenis !== 'All') c.push(filterChip(filters.jenis, 'jenis'));
    if (filters.status !== 'All') c.push(filterChip(filters.status, 'status'));
    if (filters.step !== 'All') c.push(filterChip(`Tahap ${+filters.step + 1}`, 'step'));
    if (filters.nidiTanda !== 'All') {
      const label = filters.nidiTanda === 'kosong' ? 'Belum ditandai NIDI+SLO' : NIDI_TANDA[filters.nidiTanda]?.label || filters.nidiTanda;
      c.push(filterChip(label, 'nidiTanda'));
    }
    if (filters.saving !== 'All') {
      c.push(filterChip(filters.saving === 'ada' ? 'Ada saving loket' : 'Tanpa saving loket', 'saving'));
    }
    if (filters.biaya !== 'All') c.push(filterChip('Kurang dari daftar harga', 'biaya'));
    chips.innerHTML = c.join('');

    if (!state.ready) {
      wrap.innerHTML = `<div class="space-y-3">${skeletonRows(5)}</div>`;
      pager.classList.add('hidden');
      return;
    }

    const rows = getFiltered();
    const totalPages = Math.ceil(rows.length / PER_PAGE) || 1;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    const start = (page - 1) * PER_PAGE;
    const slice = rows.slice(start, start + PER_PAGE);

    if (!rows.length) {
      wrap.innerHTML = `<div class="card">${emptyState({
        icon: 'fa-file-circle-question',
        title: 'Tidak ada permohonan',
        desc: 'Coba ubah filter atau tambah permohonan baru.',
      })}</div>`;
      pager.classList.add('hidden');
      return;
    }

    wrap.innerHTML = `
      <div class="hidden overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 lg:block">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <th class="p-3 font-semibold">ID</th>
              <th class="p-3 font-semibold">Pelanggan</th>
              <th class="p-3 font-semibold">Layanan</th>
              <th class="p-3 font-semibold">Info Pengerjaan</th>
              <th class="p-3 font-semibold">Total Biaya</th>
              <th class="p-3 font-semibold">Status</th>
              <th class="w-32 p-3 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${slice.map(rowHtml).join('')}
          </tbody>
        </table>
      </div>
      <div class="space-y-3 lg:hidden">${slice.map(cardHtml).join('')}</div>`;

    this.el.querySelector('[data-page-info]').textContent =
      `Menampilkan ${start + 1}–${Math.min(start + PER_PAGE, rows.length)} dari ${rows.length}`;
    pager.classList.remove('hidden');
    pager.classList.add('flex');
    this.el.querySelector('[data-prev]').disabled = page === 1;
    this.el.querySelector('[data-next]').disabled = page === totalPages;
  },
};

const rowHtml = (p) => `
  <tr class="align-top transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
    <td class="p-3 font-semibold text-slate-900 dark:text-white">${p.id}</td>
    <td class="p-3"><p class="font-bold text-slate-900 dark:text-white">${esc(p.nama)}</p>
      <p class="text-[11px] text-slate-400">${formatDate(p.date)}</p>
      ${gvBadges(p, 'mt-1')}</td>
    <td class="p-3">
      <span class="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
        <i class="fa-solid ${p.jenis === 'Pasang Baru' ? 'fa-plug-circle-plus text-pln-500' : 'fa-arrow-up-right-dots text-purple-500'}"></i>${esc(p.jenis)}
      </span>
      <span class="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">${esc(p.daya)} VA</span>
    </td>
    <td class="p-3">${infoPengerjaan(p)}${rincianMini(p)}<div class="mt-1.5">${nidiTandaChip(p)}</div></td>
    <td class="p-3 font-bold text-slate-900 dark:text-white">
      <span class="whitespace-nowrap">${formatRp(p.biaya)}</span>
      ${marker(p)}
    </td>
    <td class="p-3">${statusBadge(p)}</td>
    <td class="w-32 p-3">${rowActions(p)}</td>
  </tr>`;

const cardHtml = (p) => `
  <div class="card p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-bold text-slate-900 dark:text-white">${esc(p.nama)}</p>
        <p class="text-[11px] text-slate-400">${p.id} · ${formatDateShort(p.date)}</p>
        ${gvBadges(p, 'mt-1')}
      </div>
      <div class="shrink-0 text-right">${statusBadge(p)}</div>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span class="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
        <i class="fa-solid ${p.jenis === 'Pasang Baru' ? 'fa-plug-circle-plus text-pln-500' : 'fa-arrow-up-right-dots text-purple-500'}"></i>${esc(p.jenis)}
      </span>
      <span class="rounded bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">${esc(p.daya)} VA</span>
      <span class="ml-auto font-bold text-slate-900 dark:text-white">${formatRp(p.biaya)}</span>
    </div>
    ${marker(p)}
    ${rincianMini(p)}
    <div class="mt-2">${nidiTandaChip(p)}</div>
    <div class="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">${infoPengerjaan(p)}</div>
    <div class="mt-3">${rowActions(p)}</div>
  </div>`;

/* ===== actions ===== */
async function onAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;

  if (btn.dataset.act === 'foto') {
    btn.disabled = true;
    const src = await getPhoto(btn.dataset.bukti);
    btn.disabled = false;
    if (src) openImageViewer(src, btn.dataset.caption || '');
    else toast('Foto tidak ditemukan.', 'error');
    return;
  }

  const id = btn.dataset.id;
  const p = state.permohonan.find((x) => x.id === id);
  if (!p) return;

  switch (btn.dataset.act) {
    case 'bayar': return openBayar(p);
    case 'progres': return openProgressModal(id);
    case 'struk': {
      const trx = state.kas.find((k) => k.refId === id && k.tipe === 'Pemasukan');
      cetakStruk(p, trx);
      return toast('Kuitansi PDF berhasil dibuat.');
    }
    case 'edit': return requireAdmin(() => openPermForm(id));
    case 'hapus':
      return requireAdmin(() =>
        confirmDialog({
          title: 'Hapus Permohonan',
          message: 'Data permohonan dan riwayat kas terkait akan dihapus permanen.',
          confirmText: 'Ya, Hapus',
          onConfirm: async () => {
            await deletePermohonan(id);
            toast('Data dihapus permanen.');
            permohonan.refresh();
          },
        })
      );
    case 'wa': return openCopy(p);
    case 'nidi-tanda': return openNidiTandaPicker(p);
  }
}

function openBayar(p) {
  openModal({
    size: 'sm',
    title: 'Proses Pembayaran',
    body: `
      <div class="mb-4 rounded-xl bg-pln-50 p-3 text-sm text-pln-900 dark:bg-pln-950/40 dark:text-pln-200">
        <b>${esc(p.nama)}</b><br>${esc(p.jenis)} - ${esc(p.daya)} VA<br>
        Total tagihan: <b>${formatRp(p.biaya)}</b>
      </div>
      <label class="field-label">Nominal dari pelanggan (Rp) *</label>
      <input data-nom data-rp inputmode="numeric" class="input" value="${Number(p.biaya).toLocaleString('id-ID')}" />
      <div class="mt-3 flex items-end justify-between">
        <label class="field-label mb-0">Link bukti pembayaran (GDrive) *</label>
        <a href="https://drive.google.com/drive/folders/1ZvSI7s7YO0xLfcvjALuJMSq9hHbSz5qQ?usp=drive_link" target="_blank" rel="noopener"
          class="text-[11px] font-medium text-pln-600 hover:underline dark:text-pln-400"><i class="fa-solid fa-folder-open"></i> Buka Folder</a>
      </div>
      <input data-link class="input" placeholder="Paste link di sini..." />`,
    footer: `<div class="flex gap-2">
      <button data-cancel class="btn btn-ghost flex-1">Batal</button>
      <button data-ok class="btn btn-success flex-1"><i class="fa-solid fa-check"></i> Terima &amp; Lunas</button>
    </div>`,
    onMount: (ctrl) => {
      bindRupiahInputs(ctrl.root);
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-ok]').addEventListener('click', async () => {
        const nom = parseNum(ctrl.query('[data-nom]').dataset.raw);
        const link = ctrl.query('[data-link]').value.trim();
        if (nom < p.biaya) return toast('Nominal kurang dari tagihan.', 'error');
        if (!link) return toast('Masukkan link GDrive.', 'error');
        const ok = ctrl.query('[data-ok]');
        ok.disabled = true;
        ok.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await prosesBayar(p.id, nom, link);
          ctrl.close();
          toast('Pembayaran dicatat.');
          const fresh = state.permohonan.find((x) => x.id === p.id);
          const trx = state.kas.find((k) => k.refId === p.id && k.tipe === 'Pemasukan');
          setTimeout(() => cetakStruk(fresh || p, trx), 600);
        } catch (err) {
          ok.disabled = false;
          ok.innerHTML = '<i class="fa-solid fa-check"></i> Terima & Lunas';
          toast('Gagal memproses pembayaran.', 'error');
        }
      });
    },
  });
}

function openCopy(p) {
  const text =
    `Nama : ${p.nama}\nNIK : ${p.nik || '-'}\nAlamat : ${p.alamat || '-'}\nKelurahan : ${p.kelurahan || '-'}\n` +
    `Kecamatan : ${p.kecamatan || '-'}\nKabupaten : ${p.kabupaten || '-'}\nPropinsi : ${p.provinsi || '-'}\n` +
    `Tarif : ${p.tarif || '-'}\nDaya : ${p.daya || '-'}VA\nTitik koordinat : ${p.lat || '-'} ${p.long || '-'}\nUnit : ULP Agats`;
  openModal({
    size: 'md',
    title: 'Salin Format Data',
    body: `
      <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">Teks siap disalin untuk dikirim via WhatsApp.</p>
      <textarea data-tx readonly rows="11" class="input resize-none font-mono text-xs leading-relaxed">${esc(text)}</textarea>`,
    footer: `<div class="flex gap-2">
      <button data-cancel class="btn btn-ghost flex-1">Tutup</button>
      <button data-copy class="btn btn-primary flex-1"><i class="fa-solid fa-copy"></i> Salin Teks</button>
    </div>`,
    onMount: (ctrl) => {
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-copy]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = ctrl.query('[data-tx]');
          t.select();
          document.execCommand('copy');
        }
        toast('Teks disalin.');
        ctrl.close();
      });
    },
  });
}
