import {
  state, saveHargaRow, seedHarga, saveTambahDayaRow, seedTambahDaya,
} from '../store.js';
import {
  DEFAULT_HARGA, activeHarga, DEFAULT_TAMBAH_DAYA, activeTambahDaya, TAMBAH_DAYA_FIELDS,
} from '../lib/harga.js';
import { formatRp, parseNum } from '../lib/format.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { requireAdmin } from '../ui/adminGate.js';
import { bindRupiahInputs, emptyState } from '../ui/components.js';

const PB_FIELDS = [
  { key: 'bpRt', label: 'BP — RT' },
  { key: 'bpNonRt', label: 'BP — Selain RT' },
  { key: 'nidiSlo', label: 'NIDI + SLO' },
  { key: 'jspia', label: 'JSPIA' },
  { key: 'nidiSloMatJspia', label: 'NIDI + SLO + Materai + JSPIA' },
  { key: 'totalRt', label: 'Total — RT' },
  { key: 'totalNonRt', label: 'Total — Selain RT' },
  { key: 'jasaPasang', label: 'Jasa Pasang' },
  { key: 'saving', label: 'Saving' },
];

let pane = 'pb'; // 'pb' | 'td'
let calcPb = { daya: 900, rt: true };
let calcTd = { sebelum: 450, sesudah: 900, rt: true };

const rpFmt = (v) => (v ? Number(v).toLocaleString('id-ID') : '');
const vaFmt = (v) => Number(v).toLocaleString('id-ID');

export const harga = {
  el: null,
  build(el) {
    this.el = el;
    el.innerHTML = `
      <div class="mb-4">
        <h2 class="text-lg font-extrabold text-slate-900 dark:text-white md:text-xl">Daftar Harga</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400"><b>RT</b> = Rumah Tangga, <b>Selain RT</b> = non-rumah tangga. Harga BP/PD &amp; Total sudah <b>tanpa token Rp 100.000</b>.</p>
      </div>

      <div class="mb-5 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button data-pane-btn="pb" class="rounded-md px-4 py-1.5 text-sm font-semibold">Pasang Baru</button>
        <button data-pane-btn="td" class="rounded-md px-4 py-1.5 text-sm font-semibold">Tambah Daya</button>
      </div>

      <div data-pane="pb"></div>
      <div data-pane="td" hidden></div>
    `;

    el.querySelectorAll('[data-pane-btn]').forEach((b) =>
      b.addEventListener('click', () => {
        pane = b.dataset.paneBtn;
        this.refresh();
      })
    );
    el.addEventListener('click', (e) => this.onClick(e));
    el.addEventListener('change', (e) => this.onChange(e));
  },

  syncControls() {},

  onChange(e) {
    const sel = e.target.closest('select');
    if (!sel) return;
    if ('pbDaya' in sel.dataset) { calcPb.daya = Number(sel.value); this.renderCalcPb(); }
    if ('tdSebelum' in sel.dataset) {
      calcTd.sebelum = Number(sel.value);
      const opts = this.tdRows().filter((r) => r.sebelum === calcTd.sebelum).map((r) => r.sesudah);
      if (!opts.includes(calcTd.sesudah)) calcTd.sesudah = opts[0];
      this.renderTdSesudahOptions();
      this.renderCalcTd();
    }
    if ('tdSesudah' in sel.dataset) { calcTd.sesudah = Number(sel.value); this.renderCalcTd(); }
  },

  onClick(e) {
    const rt = e.target.closest('[data-rt]');
    if (rt) {
      const on = rt.dataset.rt === '1';
      if (rt.dataset.for === 'pb') calcPb.rt = on;
      else calcTd.rt = on;
      rt.dataset.for === 'pb' ? this.renderCalcPb() : this.renderCalcTd();
      return;
    }
    const seed = e.target.closest('[data-seed-btn]');
    if (seed) {
      requireAdmin(async () => {
        try {
          if (seed.dataset.seedBtn === 'pb') await seedHarga(DEFAULT_HARGA);
          else await seedTambahDaya(DEFAULT_TAMBAH_DAYA);
          toast('Daftar harga tersimpan ke database.');
        } catch { toast('Gagal menyimpan.', 'error'); }
      });
      return;
    }
    const editPb = e.target.closest('[data-edit-pb]');
    if (editPb) return requireAdmin(() => openEditPb(Number(editPb.dataset.editPb)));
    const editTd = e.target.closest('[data-edit-td]');
    if (editTd) {
      const [s, t] = editTd.dataset.editTd.split('-').map(Number);
      return requireAdmin(() => openEditTd(s, t));
    }
  },

  pbRows() { return activeHarga(state.harga); },
  tdRows() { return activeTambahDaya(state.hargaTd); },

  refresh() {
    if (!this.el) return;
    this.el.querySelectorAll('[data-pane-btn]').forEach((b) => {
      const on = b.dataset.paneBtn === pane;
      b.className = `rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
        on ? 'bg-white text-pln-600 shadow-sm dark:bg-slate-900 dark:text-pln-400' : 'text-slate-500'
      }`;
    });
    this.el.querySelector('[data-pane="pb"]').hidden = pane !== 'pb';
    this.el.querySelector('[data-pane="td"]').hidden = pane !== 'td';
    if (pane === 'pb') this.renderPb();
    else this.renderTd();
  },

  /* ---------- PASANG BARU ---------- */
  renderPb() {
    const host = this.el.querySelector('[data-pane="pb"]');
    if (!host.dataset.built) {
      host.dataset.built = '1';
      host.innerHTML = `
        ${seedBanner('pb')}
        ${calcShell('Biaya Pasang Baru', `
          <div class="sm:w-44"><label class="field-label">Daya (VA)</label><select data-pb-daya class="select"></select></div>
          ${golonganToggle('pb')}
        `)}
        ${tableShell('Tabel Pasang Baru per Daya')}
      `;
    }
    const rows = this.pbRows();
    host.querySelector('[data-seed]').classList.toggle('hidden', state.harga.length > 0 || !state.ready);
    const sel = host.querySelector('[data-pb-daya]');
    if (sel.options.length !== rows.length)
      sel.innerHTML = rows.map((r) => `<option value="${r.daya}">${vaFmt(r.daya)} VA</option>`).join('');
    if (!rows.some((r) => r.daya === calcPb.daya)) calcPb.daya = rows[0]?.daya ?? 900;
    sel.value = String(calcPb.daya);
    this.renderCalcPb();
    host.querySelector('[data-table]').innerHTML = rows.length ? pbTableHtml(rows) : emptyState({ icon: 'fa-tags', title: 'Belum ada data' });
  },

  renderCalcPb() {
    const host = this.el.querySelector('[data-pane="pb"]');
    const r = this.pbRows().find((x) => x.daya === calcPb.daya) || this.pbRows()[0];
    if (!r) return;
    paintToggle(host, 'pb', calcPb.rt);
    const bp = calcPb.rt ? r.bpRt : r.bpNonRt;
    const total = calcPb.rt ? r.totalRt : r.totalNonRt;
    host.querySelector('[data-calc-out]').innerHTML =
      tile('BP', bp) +
      tile('NIDI + SLO + Materai + JSPIA', r.nidiSloMatJspia) +
      tile('Total Dibayar Pelanggan', total, 'accent') +
      tile('Saving Loket', r.saving, 'gold');
  },

  /* ---------- TAMBAH DAYA ---------- */
  renderTd() {
    const host = this.el.querySelector('[data-pane="td"]');
    if (!host.dataset.built) {
      host.dataset.built = '1';
      host.innerHTML = `
        ${seedBanner('td')}
        <div class="mb-4 rounded-xl border border-pln-200 bg-pln-50 p-3 text-xs text-pln-700 dark:border-pln-900/50 dark:bg-pln-950/30 dark:text-pln-300">
          <i class="fa-solid fa-circle-info"></i> Biaya <b>NIDI + SLO</b> hanya berlaku bila tambah daya dari <b>1 fasa ke 3 fasa</b>
          (umumnya ke 7.700 VA ke atas). Nilainya belum tercantum — admin dapat mengisi lewat tombol edit per baris.
        </div>
        ${calcShell('Biaya Tambah Daya', `
          <div class="sm:w-40"><label class="field-label">Daya Sebelum</label><select data-td-sebelum class="select"></select></div>
          <div class="sm:w-40"><label class="field-label">Daya Sesudah</label><select data-td-sesudah class="select"></select></div>
          ${golonganToggle('td')}
        `)}
        ${tableShell('Tabel Tambah Daya (Sebelum → Sesudah)')}
      `;
    }
    const rows = this.tdRows();
    host.querySelector('[data-seed]').classList.toggle('hidden', state.hargaTd.length > 0 || !state.ready);

    const selS = host.querySelector('[data-td-sebelum]');
    const sebelumOpts = [...new Set(rows.map((r) => r.sebelum))].sort((a, b) => a - b);
    if (selS.options.length !== sebelumOpts.length)
      selS.innerHTML = sebelumOpts.map((v) => `<option value="${v}">${vaFmt(v)} VA</option>`).join('');
    if (!sebelumOpts.includes(calcTd.sebelum)) calcTd.sebelum = sebelumOpts[0] ?? 450;
    selS.value = String(calcTd.sebelum);
    this.renderTdSesudahOptions();
    this.renderCalcTd();

    host.querySelector('[data-table]').innerHTML = rows.length ? tdTableHtml(rows) : emptyState({ icon: 'fa-tags', title: 'Belum ada data' });
  },

  renderTdSesudahOptions() {
    const host = this.el.querySelector('[data-pane="td"]');
    const selT = host.querySelector('[data-td-sesudah]');
    const opts = this.tdRows().filter((r) => r.sebelum === calcTd.sebelum).map((r) => r.sesudah).sort((a, b) => a - b);
    selT.innerHTML = opts.map((v) => `<option value="${v}">${vaFmt(v)} VA</option>`).join('');
    if (!opts.includes(calcTd.sesudah)) calcTd.sesudah = opts[0];
    selT.value = String(calcTd.sesudah);
  },

  renderCalcTd() {
    const host = this.el.querySelector('[data-pane="td"]');
    const r = this.tdRows().find((x) => x.sebelum === calcTd.sebelum && x.sesudah === calcTd.sesudah);
    paintToggle(host, 'td', calcTd.rt);
    if (!r) {
      host.querySelector('[data-calc-out]').innerHTML = `<p class="text-sm text-slate-400">Kombinasi daya tidak tersedia.</p>`;
      return;
    }
    const pd = calcTd.rt ? r.pdRt : r.pdNonRt;
    const total = calcTd.rt ? r.totalRt : r.totalNonRt;
    host.querySelector('[data-calc-out]').innerHTML =
      tile('PD (Perubahan Daya)', pd) +
      tile('JSPIA', r.jspia) +
      (r.nidiSlo ? tile('NIDI + SLO', r.nidiSlo) : '') +
      tile('Total Dibayar Pelanggan', total, 'accent') +
      tile('Saving Loket', r.saving, 'gold');
  },
};

/* ================= shared bits ================= */

const seedBanner = (kind) => `
  <div data-seed class="mb-4 hidden rounded-xl border border-gold-500/40 bg-gold-500/10 p-3 text-sm text-gold-700 dark:text-gold-400">
    Masih memakai data bawaan (belum tersimpan ke database).
    <button data-seed-btn="${kind}" class="btn btn-gold btn-sm ml-2"><i class="fa-solid fa-database"></i> Simpan ke Database</button>
  </div>`;

const calcShell = (title, controls) => `
  <div class="card mb-5 p-4">
    <p class="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100"><i class="fa-solid fa-calculator text-pln-500"></i> Kalkulator Cepat — ${title}</p>
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">${controls}</div>
    <div data-calc-out class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"></div>
  </div>`;

const golonganToggle = (forKind) => `
  <div>
    <label class="field-label">Golongan</label>
    <div class="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      <button data-rt="1" data-for="${forKind}" class="rounded-md px-3 py-1.5 text-sm font-semibold">RT</button>
      <button data-rt="0" data-for="${forKind}" class="rounded-md px-3 py-1.5 text-sm font-semibold">Selain RT</button>
    </div>
  </div>`;

const tableShell = (title) => `
  <div class="card overflow-hidden">
    <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">${title}</h3>
    </div>
    <div data-table class="overflow-x-auto"></div>
  </div>`;

function paintToggle(host, forKind, rtOn) {
  host.querySelectorAll(`[data-rt][data-for="${forKind}"]`).forEach((b) => {
    const on = (b.dataset.rt === '1') === rtOn;
    b.className = `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
      on ? 'bg-white text-pln-600 shadow-sm dark:bg-slate-900 dark:text-pln-400' : 'text-slate-500'
    }`;
  });
}

const tile = (label, val, tone = '') => {
  const cls =
    tone === 'accent'
      ? 'border-pln-300 bg-pln-50 dark:border-pln-900/50 dark:bg-pln-950/30'
      : tone === 'gold'
      ? 'border-gold-500/40 bg-gold-500/10'
      : 'border-slate-200 dark:border-slate-800';
  return `<div class="rounded-xl border p-3 ${cls}">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">${label}</p>
    <p class="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">${formatRp(val)}</p>
  </div>`;
}

const TH = 'p-2.5 text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400';
const TD = 'whitespace-nowrap p-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200';

function pbTableHtml(rows) {
  const stickyTh = `${TH} !text-left sticky left-0 z-20 bg-slate-50 dark:bg-slate-800`;
  const stickyTd = 'sticky left-0 z-10 bg-white p-2.5 font-bold text-slate-900 dark:bg-slate-900 dark:text-white';
  return `
    <table class="w-full min-w-[820px] text-sm">
      <thead class="bg-slate-50 dark:bg-slate-800/60">
        <tr>
          <th rowspan="2" class="${stickyTh}">Daya (VA)</th>
          <th colspan="2" class="${TH} !text-center border-x border-slate-200 dark:border-slate-700">BP</th>
          <th rowspan="2" class="${TH}">NIDI + SLO</th>
          <th rowspan="2" class="${TH}">JSPIA</th>
          <th rowspan="2" class="${TH}">NIDI+SLO+<br>Materai+JSPIA</th>
          <th colspan="2" class="${TH} !text-center border-x border-slate-200 bg-gold-500/10 dark:border-slate-700">Total</th>
          <th rowspan="2" class="${TH}">Jasa Pasang</th>
          <th rowspan="2" class="${TH}">Saving</th>
          <th rowspan="2" class="${TH} !text-center">Aksi</th>
        </tr>
        <tr>
          <th class="${TH} border-l border-slate-200 dark:border-slate-700">RT</th>
          <th class="${TH} border-r border-slate-200 dark:border-slate-700">Selain RT</th>
          <th class="${TH} border-l border-slate-200 bg-gold-500/10 dark:border-slate-700">RT</th>
          <th class="${TH} border-r border-slate-200 bg-gold-500/10 dark:border-slate-700">Selain RT</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        ${rows.map((r) => `
          <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
            <td class="${stickyTd}">${vaFmt(r.daya)}</td>
            <td class="${TD}">${formatRp(r.bpRt)}</td>
            <td class="${TD}">${formatRp(r.bpNonRt)}</td>
            <td class="${TD}">${r.nidiSlo ? formatRp(r.nidiSlo) : '–'}</td>
            <td class="${TD}">${formatRp(r.jspia)}</td>
            <td class="${TD}">${formatRp(r.nidiSloMatJspia)}</td>
            <td class="${TD} bg-gold-500/5 font-bold text-slate-900 dark:text-white">${formatRp(r.totalRt)}</td>
            <td class="${TD} bg-gold-500/5 font-bold text-slate-900 dark:text-white">${formatRp(r.totalNonRt)}</td>
            <td class="${TD}">${formatRp(r.jasaPasang)}</td>
            <td class="${TD} font-semibold text-leaf-600 dark:text-leaf-400">${formatRp(r.saving)}</td>
            <td class="p-2.5 text-center"><button data-edit-pb="${r.daya}" class="btn-icon btn-ghost" title="Edit"><i class="fa-solid fa-pen text-[10px]"></i></button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function tdTableHtml(rows) {
  const stickyTh = `${TH} !text-left sticky left-0 z-20 bg-slate-50 dark:bg-slate-800`;
  const stickyTd = 'sticky left-0 z-10 bg-white p-2.5 text-center font-bold text-slate-900 dark:bg-slate-900 dark:text-white';
  // kelompokkan per "sebelum" untuk rowspan
  const groups = [];
  rows.forEach((r) => {
    const g = groups.find((x) => x.sebelum === r.sebelum);
    if (g) g.items.push(r);
    else groups.push({ sebelum: r.sebelum, items: [r] });
  });
  return `
    <table class="w-full min-w-[860px] text-sm">
      <thead class="bg-slate-50 dark:bg-slate-800/60">
        <tr>
          <th rowspan="2" class="${stickyTh}">Daya<br>Sebelum</th>
          <th rowspan="2" class="${TH} !text-center">Daya<br>Sesudah</th>
          <th colspan="2" class="${TH} !text-center border-x border-slate-200 dark:border-slate-700">PD</th>
          <th rowspan="2" class="${TH}">NIDI + SLO</th>
          <th rowspan="2" class="${TH}">JSPIA</th>
          <th colspan="2" class="${TH} !text-center border-x border-slate-200 bg-gold-500/10 dark:border-slate-700">Total</th>
          <th rowspan="2" class="${TH}">Jasa Pasang</th>
          <th rowspan="2" class="${TH}">Saving</th>
          <th rowspan="2" class="${TH} !text-center">Aksi</th>
        </tr>
        <tr>
          <th class="${TH} border-l border-slate-200 dark:border-slate-700">RT</th>
          <th class="${TH} border-r border-slate-200 dark:border-slate-700">Selain RT</th>
          <th class="${TH} border-l border-slate-200 bg-gold-500/10 dark:border-slate-700">RT</th>
          <th class="${TH} border-r border-slate-200 bg-gold-500/10 dark:border-slate-700">Selain RT</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        ${groups.map((g) => g.items.map((r, i) => `
          <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
            ${i === 0 ? `<td rowspan="${g.items.length}" class="${stickyTd} border-r border-slate-100 align-middle dark:border-slate-800">${vaFmt(g.sebelum)}</td>` : ''}
            <td class="p-2.5 text-center font-bold text-slate-900 dark:text-white">${vaFmt(r.sesudah)}</td>
            <td class="${TD}">${formatRp(r.pdRt)}</td>
            <td class="${TD}">${formatRp(r.pdNonRt)}</td>
            <td class="${TD}">${r.nidiSlo ? formatRp(r.nidiSlo) : '–'}</td>
            <td class="${TD}">${formatRp(r.jspia)}</td>
            <td class="${TD} bg-gold-500/5 font-bold text-slate-900 dark:text-white">${formatRp(r.totalRt)}</td>
            <td class="${TD} bg-gold-500/5 font-bold text-slate-900 dark:text-white">${formatRp(r.totalNonRt)}</td>
            <td class="${TD}">${formatRp(r.jasaPasang)}</td>
            <td class="${TD} font-semibold text-leaf-600 dark:text-leaf-400">${formatRp(r.saving)}</td>
            <td class="p-2.5 text-center"><button data-edit-td="${r.sebelum}-${r.sesudah}" class="btn-icon btn-ghost" title="Edit"><i class="fa-solid fa-pen text-[10px]"></i></button></td>
          </tr>`).join('')).join('')}
      </tbody>
    </table>`;
}

/* ================= edit modals ================= */

function editModal({ title, fields, current, onSave }) {
  openModal({
    size: 'md',
    title,
    body: `<div class="grid gap-3 sm:grid-cols-2">
      ${fields.map((f) => `<div>
        <label class="field-label">${f.label}</label>
        <input data-f="${f.key}" data-rp inputmode="numeric" class="input" value="${rpFmt(current[f.key])}" />
      </div>`).join('')}
    </div>`,
    footer: `<div class="flex gap-2">
      <button data-cancel class="btn btn-ghost flex-1">Batal</button>
      <button data-ok class="btn btn-primary flex-1">Simpan</button>
    </div>`,
    onMount: (ctrl) => {
      bindRupiahInputs(ctrl.root);
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-ok]').addEventListener('click', async () => {
        const data = {};
        fields.forEach((f) => (data[f.key] = parseNum(ctrl.query(`[data-f="${f.key}"]`).dataset.raw)));
        const ok = ctrl.query('[data-ok]');
        ok.disabled = true;
        ok.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await onSave(data);
          ctrl.close();
          toast('Harga diperbarui.');
        } catch {
          ok.disabled = false;
          ok.textContent = 'Simpan';
          toast('Gagal menyimpan.', 'error');
        }
      });
    },
  });
}

function openEditPb(daya) {
  const r = activeHarga(state.harga).find((x) => x.daya === daya) || { daya };
  editModal({
    title: `Edit Pasang Baru — ${vaFmt(daya)} VA`,
    fields: PB_FIELDS,
    current: r,
    onSave: (data) => saveHargaRow(daya, data),
  });
}

function openEditTd(sebelum, sesudah) {
  const r = activeTambahDaya(state.hargaTd).find((x) => x.sebelum === sebelum && x.sesudah === sesudah) || { sebelum, sesudah };
  editModal({
    title: `Edit Tambah Daya — ${vaFmt(sebelum)} → ${vaFmt(sesudah)} VA`,
    fields: TAMBAH_DAYA_FIELDS,
    current: r,
    onSave: (data) => saveTambahDayaRow(sebelum, sesudah, data),
  });
}
