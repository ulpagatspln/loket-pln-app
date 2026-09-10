import { state, calculateSaldo, tambahKas, tarikKas, updateKas, deleteKas } from '../store.js';
import { formatRp, formatDateShort, formatTime, MONTHS, esc, parseNum } from '../lib/format.js';
import { emptyState, skeletonRows, filterChip, bindRupiahInputs } from '../ui/components.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { requireAdmin } from '../ui/adminGate.js';

const PER_PAGE = 10;
const now = new Date();
let page = 1;
let filters = { q: '', month: String(now.getMonth()), year: String(now.getFullYear()) };

function balanceMap() {
  const map = {};
  let run = 0;
  [...state.kas]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((k) => {
      run += k.tipe === 'Pemasukan' ? k.nominal : -k.nominal;
      map[k.id] = run;
    });
  return map;
}

function getFiltered() {
  const q = filters.q.toLowerCase();
  return state.kas
    .filter((k) => {
      const d = new Date(k.date);
      return (
        (!q || k.ket.toLowerCase().includes(q) || k.id.toLowerCase().includes(q)) &&
        (filters.month === 'All' || d.getMonth() === +filters.month) &&
        (filters.year === 'All' || d.getFullYear() === +filters.year)
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const kas = {
  el: null,
  build(el) {
    this.el = el;
    el.innerHTML = `
      <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900 dark:text-white md:text-xl">Buku Kas Loket</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Riwayat transaksi keuangan dan penarikan.</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div class="flex items-center justify-between gap-4 rounded-xl border border-pln-200 bg-pln-50 px-4 py-2.5 dark:border-pln-900/50 dark:bg-pln-950/40 sm:flex-col sm:items-end sm:justify-center sm:text-right">
            <span class="text-[10px] font-bold uppercase tracking-wide text-pln-600 dark:text-pln-400">Saldo Kas Laci</span>
            <span data-saldo class="text-lg font-extrabold text-pln-900 dark:text-pln-200">Rp 0</span>
          </div>
          <div class="flex gap-2">
            <button data-add class="btn btn-success flex-1"><i class="fa-solid fa-plus"></i> Tambah</button>
            <button data-tarik class="btn btn-danger flex-1"><i class="fa-solid fa-money-bill-wave"></i> Tarik</button>
          </div>
        </div>
      </div>

      <div data-summary class="mb-4 grid gap-3 sm:grid-cols-3"></div>

      <div class="card mb-4 p-3">
        <div class="flex flex-col gap-2 sm:flex-row">
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input data-q class="input pl-10" placeholder="Cari keterangan atau ID..." />
          </div>
          <select data-f="month" class="select sm:w-40">
            <option value="All">Semua Bulan</option>
            ${MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('')}
          </select>
          <select data-f="year" class="select sm:w-36"></select>
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

    el.querySelector('[data-add]').addEventListener('click', openTambah);
    el.querySelector('[data-tarik]').addEventListener('click', openTarik);
    const q = el.querySelector('[data-q]');
    q.addEventListener('input', () => { filters.q = q.value; page = 1; this.refresh(); });
    el.querySelectorAll('[data-f]').forEach((s) =>
      s.addEventListener('change', () => { filters[s.dataset.f] = s.value; page = 1; this.refresh(); })
    );
    el.querySelector('[data-chips]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-clear-filter]');
      if (!b) return;
      filters[b.dataset.clearFilter] = b.dataset.clearFilter === 'q' ? '' : 'All';
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
    const years = new Set(state.kas.map((k) => new Date(k.date).getFullYear()));
    years.add(now.getFullYear());
    this.el.querySelector('[data-f="year"]').innerHTML =
      `<option value="All">Semua Tahun</option>` +
      [...years].sort().reverse().map((y) => `<option value="${y}">${y}</option>`).join('');
    ['month', 'year'].forEach((k) => (this.el.querySelector(`[data-f="${k}"]`).value = filters[k]));
  },

  refresh() {
    if (!this.el) return;
    this.el.querySelector('[data-saldo]').textContent = formatRp(calculateSaldo());
    const wrap = this.el.querySelector('[data-results]');
    const pager = this.el.querySelector('[data-pager]');

    const chips = [];
    if (filters.q) chips.push(filterChip(`"${filters.q}"`, 'q'));
    if (filters.month !== 'All') chips.push(filterChip(MONTHS[+filters.month], 'month'));
    if (filters.year !== 'All') chips.push(filterChip(filters.year, 'year'));
    this.el.querySelector('[data-chips]').innerHTML = chips.join('');

    if (!state.ready) {
      this.el.querySelector('[data-summary]').innerHTML = skeletonRows(1).repeat(3);
      wrap.innerHTML = `<div class="space-y-3">${skeletonRows(5)}</div>`;
      pager.classList.add('hidden');
      return;
    }

    const rows = getFiltered();
    let kPPOB = 0, kPasang = 0, kNidi = 0;
    rows.forEach((k) => {
      if (k.tipe === 'Pemasukan' || k.tipe === 'Penarikan') return;
      if (k.ket.includes('PPOB')) kPPOB += k.nominal;
      else if (k.ket.includes('Pemasangan')) kPasang += k.nominal;
      else if (k.ket.includes('NIDI')) kNidi += k.nominal;
    });
    const sum = (label, v, icon) => `
      <div class="card flex items-center justify-between gap-3 p-4">
        <div class="min-w-0">
          <p class="truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">${label}</p>
          <p class="truncate text-lg font-extrabold text-red-600 dark:text-red-400">${formatRp(v)}</p>
        </div>
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/40"><i class="fa-solid ${icon}"></i></div>
      </div>`;
    this.el.querySelector('[data-summary]').innerHTML =
      sum('Keluar PPOB', kPPOB, 'fa-money-bill-transfer') +
      sum('Keluar Pasang', kPasang, 'fa-helmet-safety') +
      sum('Keluar NIDI/SLO', kNidi, 'fa-file-signature');

    if (!rows.length) {
      wrap.innerHTML = `<div class="card">${emptyState({
        icon: 'fa-receipt',
        title: 'Belum ada transaksi',
        desc: 'Riwayat transaksi kas akan tampil di sini.',
      })}</div>`;
      pager.classList.add('hidden');
      return;
    }

    const bal = balanceMap();
    const totalPages = Math.ceil(rows.length / PER_PAGE) || 1;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    const start = (page - 1) * PER_PAGE;
    const slice = rows.slice(start, start + PER_PAGE);

    wrap.innerHTML = `
      <div class="hidden overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 lg:block">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <th class="p-3 font-semibold">Tanggal</th>
              <th class="p-3 font-semibold">Keterangan</th>
              <th class="p-3 text-right font-semibold">Masuk</th>
              <th class="p-3 text-right font-semibold">Keluar</th>
              <th class="p-3 text-right font-semibold">Saldo</th>
              <th class="w-24 p-3 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${slice.map((k) => rowHtml(k, bal[k.id])).join('')}
          </tbody>
        </table>
      </div>
      <div class="space-y-3 lg:hidden">${slice.map((k) => cardHtml(k, bal[k.id])).join('')}</div>`;

    this.el.querySelector('[data-page-info]').textContent =
      `Menampilkan ${start + 1}–${Math.min(start + PER_PAGE, rows.length)} dari ${rows.length}`;
    pager.classList.remove('hidden');
    pager.classList.add('flex');
    this.el.querySelector('[data-prev]').disabled = page === 1;
    this.el.querySelector('[data-next]').disabled = page === totalPages;
  },
};

const typeMeta = (k) => {
  if (k.tipe === 'Pemasukan') return { label: 'Masuk', cls: 'badge-green', icon: 'fa-arrow-down' };
  if (k.tipe === 'Penarikan') return { label: 'Tarik', cls: 'badge-amber', icon: 'fa-money-bill-wave' };
  return { label: 'Keluar', cls: 'badge-amber', icon: 'fa-arrow-up' };
};

const linkBtn = (k) =>
  k.link
    ? `<a href="${esc(k.link)}" target="_blank" rel="noopener" class="btn-icon btn-ghost text-pln-600 dark:text-pln-400"><i class="fa-solid fa-link"></i></a>`
    : '';

const actionBtns = (k) => `
  ${linkBtn(k)}
  <button data-act="edit" data-id="${k.id}" class="btn-icon btn-ghost"><i class="fa-solid fa-pen"></i></button>
  <button data-act="hapus" data-id="${k.id}" class="btn-icon bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"><i class="fa-solid fa-trash"></i></button>`;

const rowHtml = (k, saldo) => {
  const isMasuk = k.tipe === 'Pemasukan';
  return `
  <tr class="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
    <td class="whitespace-nowrap p-3 text-slate-600 dark:text-slate-300">
      <div class="font-medium">${formatDateShort(k.date)}</div><div class="text-[10px] text-slate-400">${formatTime(k.date)}</div>
    </td>
    <td class="p-3">
      <p class="font-semibold text-slate-900 dark:text-white">${esc(k.ket)}</p>
      <p class="text-[10px] text-slate-400">ID: ${k.id}${k.refId ? ` · Ref: ${k.refId}` : ''}</p>
    </td>
    <td class="p-3 text-right font-bold text-leaf-600 dark:text-leaf-400">${isMasuk ? formatRp(k.nominal) : '–'}</td>
    <td class="p-3 text-right font-bold ${k.tipe === 'Penarikan' ? 'text-amber-500' : 'text-red-500 dark:text-red-400'}">${!isMasuk ? formatRp(k.nominal) : '–'}</td>
    <td class="whitespace-nowrap p-3 text-right font-semibold text-slate-700 dark:text-slate-200">${formatRp(saldo)}</td>
    <td class="w-24 p-3"><div class="flex items-center justify-center gap-1">${actionBtns(k)}</div></td>
  </tr>`;
};

const cardHtml = (k, saldo) => {
  const isMasuk = k.tipe === 'Pemasukan';
  const m = typeMeta(k);
  return `
  <div class="card p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-slate-900 dark:text-white">${esc(k.ket)}</p>
        <p class="text-[10px] text-slate-400">${k.id}${k.refId ? ` · Ref: ${k.refId}` : ''} · ${formatDateShort(k.date)} ${formatTime(k.date)}</p>
      </div>
      <span class="badge ${m.cls} shrink-0"><i class="fa-solid ${m.icon}"></i> ${m.label}</span>
    </div>
    <div class="mt-3 flex items-end justify-between">
      <div>
        <p class="text-[10px] uppercase tracking-wide text-slate-400">Nominal</p>
        <p class="text-lg font-extrabold ${isMasuk ? 'text-leaf-600 dark:text-leaf-400' : k.tipe === 'Penarikan' ? 'text-amber-500' : 'text-red-500 dark:text-red-400'}">
          ${isMasuk ? '+' : '−'} ${formatRp(k.nominal)}
        </p>
        <p class="text-[11px] text-slate-400">Saldo: ${formatRp(saldo)}</p>
      </div>
      <div class="flex gap-1">${actionBtns(k)}</div>
    </div>
  </div>`;
};

/* ===== actions ===== */
function onAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  const k = state.kas.find((x) => x.id === id);
  if (!k) return;
  if (btn.dataset.act === 'edit') return requireAdmin(() => openEdit(k));
  if (btn.dataset.act === 'hapus')
    return requireAdmin(() =>
      confirmDialog({
        title: 'Hapus Transaksi',
        message: 'Transaksi kas ini akan dihapus permanen.',
        confirmText: 'Ya, Hapus',
        onConfirm: async () => {
          await deleteKas(id);
          toast('Transaksi dihapus permanen.');
          kas.refresh();
        },
      })
    );
}

function amountModal({ title, icon, tone, note, confirmText, onSubmit }) {
  openModal({
    size: 'sm',
    title,
    body: `
      ${note ? `<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">${note}</p>` : ''}
      <label class="field-label">Nominal (Rp) *</label>
      <input data-nom data-rp inputmode="numeric" class="input" />
      <label class="field-label mt-3">Keterangan *</label>
      <input data-ket class="input" />`,
    footer: `<div class="flex gap-2">
      <button data-cancel class="btn btn-ghost flex-1">Batal</button>
      <button data-ok class="btn ${tone} flex-1"><i class="fa-solid ${icon}"></i> ${confirmText}</button>
    </div>`,
    onMount: (ctrl) => {
      bindRupiahInputs(ctrl.root);
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-ok]').addEventListener('click', async () => {
        const nom = parseNum(ctrl.query('[data-nom]').dataset.raw);
        const ket = ctrl.query('[data-ket]').value.trim();
        if (!nom || nom <= 0) return toast('Nominal tidak valid.', 'error');
        if (!ket) return toast('Keterangan wajib diisi.', 'error');
        const ok = ctrl.query('[data-ok]');
        ok.disabled = true;
        ok.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await onSubmit(nom, ket, ctrl);
          ctrl.close();
        } catch (err) {
          ok.disabled = false;
          ok.innerHTML = `<i class="fa-solid ${icon}"></i> ${confirmText}`;
          if (err?.message !== 'handled') toast('Gagal menyimpan.', 'error');
        }
      });
    },
  });
}

function openTambah() {
  amountModal({
    title: 'Tambah Saldo',
    icon: 'fa-check',
    tone: 'btn-success',
    confirmText: 'Simpan',
    note: 'Menambah pemasukan manual ke laci kas (mis. tambahan kembalian, modal awal).',
    onSubmit: async (nom, ket) => {
      await tambahKas(nom, ket);
      toast('Pemasukan berhasil ditambahkan.');
      kas.refresh();
    },
  });
}

function openTarik() {
  amountModal({
    title: 'Penarikan Kas',
    icon: 'fa-check',
    tone: 'btn-danger',
    confirmText: 'Tarik',
    note: `Saldo tersedia: ${formatRp(calculateSaldo())}.`,
    onSubmit: async (nom, ket) => {
      if (nom > calculateSaldo()) {
        toast('Saldo tidak mencukupi.', 'error');
        throw new Error('handled');
      }
      await tarikKas(nom, ket);
      toast('Penarikan berhasil dicatat.');
      kas.refresh();
    },
  });
}

function openEdit(k) {
  openModal({
    size: 'sm',
    title: 'Edit Transaksi Kas',
    body: `
      <label class="field-label">Keterangan transaksi</label>
      <input data-ket class="input" value="${esc(k.ket)}" />
      <label class="field-label mt-3">Nominal (Rp)</label>
      <input data-nom data-rp inputmode="numeric" class="input" value="${Number(k.nominal).toLocaleString('id-ID')}" />`,
    footer: `<div class="flex gap-2">
      <button data-cancel class="btn btn-ghost flex-1">Batal</button>
      <button data-ok class="btn btn-primary flex-1">Simpan Perubahan</button>
    </div>`,
    onMount: (ctrl) => {
      bindRupiahInputs(ctrl.root);
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-ok]').addEventListener('click', async () => {
        const ket = ctrl.query('[data-ket]').value.trim();
        const nom = parseNum(ctrl.query('[data-nom]').dataset.raw);
        if (!ket || !nom) return toast('Isi semua kolom.', 'error');
        const ok = ctrl.query('[data-ok]');
        ok.disabled = true;
        ok.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await updateKas(k.id, ket, nom);
          ctrl.close();
          toast('Transaksi kas diperbarui.');
          kas.refresh();
        } catch {
          ok.disabled = false;
          ok.textContent = 'Simpan Perubahan';
          toast('Gagal menyimpan.', 'error');
        }
      });
    },
  });
}
