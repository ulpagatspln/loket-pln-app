import { state, calculateSaldo, gvBelumMasuk } from '../store.js';
import { formatRp, formatRpShort, formatDate, MONTHS, esc } from '../lib/format.js';
import { nidiSloWajib, rincianDana, hargaTotalUntuk } from '../lib/harga.js';
import { NIDI_TANDA } from '../ui/nidiTanda.js';
import { statCard, skeletonCards } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { goToPermohonan } from './permohonan.js';
import { openPermForm } from './permForm.js';

let chart;

// Urutan & warna kartu ringkasan penanda NIDI+SLO di dashboard.
const NIDI_STATUS_ORDER = [
  { key: 'titip', ...NIDI_TANDA.titip, tone: 'bg-leaf-500/15 text-leaf-600', withRp: true },
  { key: 'tidak_titip', ...NIDI_TANDA.tidak_titip, tone: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40', withRp: true },
  { key: 'tidak_perlu', ...NIDI_TANDA.tidak_perlu, tone: 'bg-slate-200 text-slate-500 dark:bg-slate-700', withRp: false },
  { key: 'dibayar', ...NIDI_TANDA.dibayar, tone: 'bg-pln-500/15 text-pln-600', withRp: false },
  { key: 'kosong', label: 'Belum Ditandai', icon: 'fa-circle-question', tone: 'bg-slate-100 text-slate-400 dark:bg-slate-800', withRp: false },
];

// Kategori peruntukan tarik kas — dicocokkan dari kata kunci di keterangan (urutan = prioritas).
const KAS_KATEGORI = [
  { key: 'sosial', label: 'Sosial & Kedukaan', icon: 'fa-heart', bar: 'bg-pink-500', test: /karangan bunga|sumbangan|duka|ultah/i },
  { key: 'air', label: 'Air Kantor', icon: 'fa-droplet', bar: 'bg-sky-500', test: /\bblong\b|air kantor|filter air/i },
  { key: 'konsumsi', label: 'Konsumsi & Jamuan Tamu', icon: 'fa-mug-hot', bar: 'bg-amber-500', test: /makan|minum|snack|kopi|kue|tamu|\bteh\b|aqua|nasi|tumpeng|roti|es buah|tissu|tisu/i },
  { key: 'lapangan', label: 'Pekerjaan Lapangan', icon: 'fa-screwdriver-wrench', bar: 'bg-purple-500', test: /grounding|pemerataan beban|\bkabel\b|\bviar\b|bensin|\bsolar\b|pengerjaan/i },
  { key: 'admin', label: 'Operasional & Administrasi', icon: 'fa-building', bar: 'bg-slate-400', test: /materai|hosting|top ?up|ongkir|ongkos kirim|\bpanel\b|retribusi|akrilik|beli tanah/i },
  { key: 'lain', label: 'Lainnya', icon: 'fa-ellipsis', bar: 'bg-slate-300 dark:bg-slate-600', test: null },
];
const kategoriTarik = (ket) => KAS_KATEGORI.find((c) => c.test?.test(ket || '')) || KAS_KATEGORI[KAS_KATEGORI.length - 1];

const PIPE = [
  { step: 0, label: 'Belum Pembayaran PPOB', icon: 'fa-money-bill-transfer', tone: 'bg-pln-500/15 text-pln-500 dark:text-pln-300' },
  { step: 1, label: 'Belum Pemasangan', icon: 'fa-helmet-safety', tone: 'bg-gold-500/15 text-gold-600 dark:text-gold-400' },
  { step: 2, label: 'Belum Penginputan FSO', icon: 'fa-keyboard', tone: 'bg-iris-500/15 text-iris-500 dark:text-iris-300' },
  { step: 3, label: 'Belum Peremajaan AP2T', icon: 'fa-server', tone: 'bg-pink-500/15 text-pink-500 dark:text-pink-400' },
  { step: 4, label: 'Belum Bayar NIDI & SLO', icon: 'fa-money-check-dollar', tone: 'bg-teal-500/15 text-teal-500 dark:text-teal-300' },
  { step: 5, label: 'Belum Upload Berkas NIDI', icon: 'fa-file-signature', tone: 'bg-leaf-500/15 text-leaf-600 dark:text-leaf-400' },
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
      <div data-metrics class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"></div>
      <div class="mb-6 grid gap-4 lg:grid-cols-3">
        <div class="card p-4 lg:col-span-2">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Saving &amp; Tarik Kas <span class="font-normal text-slate-400">— 3 Bln</span></h3>
            <div class="flex items-center gap-1.5">
              <span class="badge badge-green"><i class="fa-solid fa-piggy-bank"></i> Saving Loket</span>
              <span class="badge badge-amber"><i class="fa-solid fa-money-bill-wave"></i> Tarik Kas</span>
            </div>
          </div>
          <div class="h-52"><canvas data-chart></canvas></div>
          <div class="my-3 border-t border-slate-100 dark:border-slate-800"></div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            <i class="fa-solid fa-magnifying-glass-dollar"></i> Analisa Keperluan Tarik Kas — 3 Bln Terakhir
          </p>
          <div data-tarik-analisa class="space-y-2"></div>
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

      <div class="mb-3 flex items-center gap-2">
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">
          <i class="fa-solid fa-tag text-pln-500"></i> Penanda NIDI+SLO
        </h3>
      </div>
      <div data-nidi-status class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"></div>

      <div class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <i class="fa-solid fa-clipboard-list text-gold-500"></i> NOAGENDA Belum Masuk Permohonan
              <span data-gv-count class="badge badge-amber hidden"></span>
            </h3>
            <p data-gv-meta class="mt-0.5 text-xs text-slate-400">Belum ada data GV yang diimpor.</p>
            <div data-gv-jenis class="mt-1.5 flex hidden flex-wrap gap-1.5"></div>
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
    el.querySelector('[data-nidi-status]').addEventListener('click', onCardClick);
    el.querySelector('[data-today]').addEventListener('click', onCardClick);
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
      this.el.querySelector('[data-metrics]').innerHTML = skeletonCards(4);
      return;
    }
    const saldo = calculateSaldo();
    let waiting = 0, lunas = 0;
    const counts = [0, 0, 0, 0, 0, 0];
    const nidiCount = { titip: 0, tidak_titip: 0, tidak_perlu: 0, dibayar: 0, kosong: 0 };
    const nidiRp = { titip: 0, tidak_titip: 0 };
    let adaSaving = 0, tanpaSaving = 0, kurangBayar = 0;
    const adaSavingJenis = { 'Pasang Baru': 0, 'Tambah Daya': 0 };
    const tanpaSavingJenis = { 'Pasang Baru': 0, 'Tambah Daya': 0 };
    const kurangJenis = { 'Pasang Baru': 0, 'Tambah Daya': 0 };
    for (const p of state.permohonan) {
      if (p.status === 'Menunggu Pembayaran') waiting++;
      if (p.status === 'Lunas' || p.status === 'Selesai') lunas++;
      if (p.status === 'Lunas' && p.step >= 0 && p.step < 6) counts[p.step]++;

      const key = p.nidiTanda && NIDI_TANDA[p.nidiTanda] ? p.nidiTanda : 'kosong';
      nidiCount[key]++;
      if (key === 'titip' || key === 'tidak_titip') nidiRp[key] += nidiSloWajib(p);

      const d = rincianDana(p, state.kas, state.harga, state.hargaTd);
      if (d) {
        if (d.saving > 0) {
          adaSaving++;
          if (adaSavingJenis[p.jenis] != null) adaSavingJenis[p.jenis]++;
        } else {
          tanpaSaving++;
          if (tanpaSavingJenis[p.jenis] != null) tanpaSavingJenis[p.jenis]++;
        }
      }

      // Total biaya pelanggan di bawah Total daftar harga (sama seperti badge "Kurang")
      const h = hargaTotalUntuk(p, state.harga, state.hargaTd);
      if (h && Number(p.biaya || 0) < h.total) {
        kurangBayar++;
        if (kurangJenis[p.jenis] != null) kurangJenis[p.jenis]++;
      }
    }

    this.el.querySelector('[data-nidi-status]').innerHTML = NIDI_STATUS_ORDER.map(
      (s) => `
      <div role="button" tabindex="0" data-action="nidi-tanda:${s.key}"
        class="card flex cursor-pointer flex-col gap-2 p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <div class="grid h-9 w-9 place-items-center rounded-xl text-sm ${s.tone}"><i class="fa-solid ${s.icon}"></i></div>
        <div>
          <p class="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400">${s.label}</p>
          <p class="text-lg font-extrabold text-slate-900 dark:text-white">${nidiCount[s.key]} <span class="text-xs font-normal text-slate-400">permohonan</span></p>
          ${s.withRp ? `<p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">${formatRp(nidiRp[s.key])}</p>` : ''}
        </div>
      </div>`
    ).join('');

    const kasDapatDigunakan = Math.max(0, saldo - nidiRp.titip);
    this.el.querySelector('[data-metrics]').innerHTML = [
      statCard({ label: 'Total Saldo Kas', value: formatRp(saldo), icon: 'fa-wallet', tone: 'pln' }),
      statCard({
        label: 'Kas yang Dapat Digunakan',
        value: formatRp(kasDapatDigunakan),
        icon: 'fa-sack-dollar',
        tone: 'iris',
        sub: `− Titipan NIDI+SLO ${formatRp(nidiRp.titip)}`,
      }),
      statCard({ label: 'Menunggu Pembayaran', value: `${waiting} berkas`, icon: 'fa-clock', tone: 'gold', onClick: 'wait' }),
      statCard({ label: 'Permohonan Lunas', value: `${lunas} berkas`, icon: 'fa-file-circle-check', tone: 'leaf', onClick: 'lunas' }),
    ].join('');

    // Ringkasan hari ini
    const today = new Date().toDateString();
    const kasToday = state.kas.filter((k) => new Date(k.date).toDateString() === today);
    const masukToday = kasToday.filter((k) => k.tipe === 'Pemasukan').reduce((s, k) => s + k.nominal, 0);
    const permToday = state.permohonan.filter((p) => new Date(p.date).toDateString() === today).length;
    this.el.querySelector('[data-today]').innerHTML = `
      <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Hari Ini</p>
      <div class="flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-leaf-500/15 text-leaf-600"><i class="fa-solid fa-arrow-down"></i></div>
        <div><p class="text-lg font-extrabold text-slate-900 dark:text-white">${formatRp(masukToday)}</p><p class="text-[11px] text-slate-400">Kas masuk</p></div>
      </div>
      <div class="flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-pln-500/15 text-pln-600"><i class="fa-solid fa-file-signature"></i></div>
        <div><p class="text-lg font-extrabold text-slate-900 dark:text-white">${permToday}</p><p class="text-[11px] text-slate-400">Permohonan baru</p></div>
      </div>
      <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>
      <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Saving Loket</p>
      <div role="button" tabindex="0" data-action="saving:ada" class="flex cursor-pointer items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-leaf-500/15 text-leaf-600"><i class="fa-solid fa-piggy-bank"></i></div>
        <div>
          <p class="text-lg font-extrabold text-slate-900 dark:text-white">${adaSaving}</p>
          <p class="text-[11px] text-slate-400">Ada saving loket</p>
          <p class="text-[10px] text-slate-400">PB ${adaSavingJenis['Pasang Baru']} · TD ${adaSavingJenis['Tambah Daya']}</p>
        </div>
      </div>
      <div role="button" tabindex="0" data-action="saving:tanpa" class="flex cursor-pointer items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"><i class="fa-solid fa-piggy-bank"></i></div>
        <div>
          <p class="text-lg font-extrabold text-slate-900 dark:text-white">${tanpaSaving}</p>
          <p class="text-[11px] text-slate-400">Tanpa saving loket</p>
          <p class="text-[10px] text-slate-400">PB ${tanpaSavingJenis['Pasang Baru']} · TD ${tanpaSavingJenis['Tambah Daya']}</p>
        </div>
      </div>
      <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>
      <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Biaya vs Daftar Harga</p>
      <div role="button" tabindex="0" data-action="biaya:kurang" class="flex cursor-pointer items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-red-500/15 text-red-500 dark:text-red-400"><i class="fa-solid fa-arrow-down"></i></div>
        <div>
          <p class="text-lg font-extrabold text-slate-900 dark:text-white">${kurangBayar}</p>
          <p class="text-[11px] text-slate-400">Kurang dari daftar harga</p>
          <p class="text-[10px] text-slate-400">PB ${kurangJenis['Pasang Baru']} · TD ${kurangJenis['Tambah Daya']}</p>
        </div>
      </div>`;

    // Pipeline
    this.el.querySelector('[data-pipeline]').innerHTML = PIPE.map(
      (s) => `
      <div role="button" tabindex="0" data-action="step:${s.step}"
        class="card flex h-24 cursor-pointer flex-col justify-between p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <div class="flex items-center justify-between">
          <div class="grid h-8 w-8 place-items-center rounded-xl text-xs ${s.tone}"><i class="fa-solid ${s.icon}"></i></div>
          <span class="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">${counts[s.step]}</span>
        </div>
        <p class="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">${s.label}</p>
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

    // Rincian jenis (pemetaan sama dengan prefill form: PERUBAHAN DAYA -> Tambah Daya, sisanya Pasang Baru)
    const jenisEl = this.el.querySelector('[data-gv-jenis]');
    if (jenisEl) {
      const td = belum.filter((r) => /PERUBAHAN DAYA/i.test(r.jenis || '')).length;
      const pb = belum.length - td;
      jenisEl.classList.toggle('hidden', belum.length === 0);
      jenisEl.innerHTML = belum.length
        ? `<span class="badge bg-pln-500/15 text-pln-600 dark:text-pln-300"><i class="fa-solid fa-plug-circle-plus"></i> Pasang Baru: ${pb}</span>
           <span class="badge bg-iris-500/15 text-iris-600 dark:text-iris-300"><i class="fa-solid fa-arrow-up-right-dots"></i> Tambah Daya: ${td}</span>`
        : '';
    }

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
                  ${r.alamat ? `<p class="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400" title="${esc(r.alamat)}"><i class="fa-solid fa-location-dot mt-0.5 shrink-0 text-slate-400"></i><span class="line-clamp-2">${esc(r.alamat)}</span></p>` : ""}
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
    const savingBuckets = [];
    const tarikBuckets = [];
    const BULAN_TAMPIL = 3;
    for (let i = BULAN_TAMPIL - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(MONTHS[d.getMonth()].slice(0, 3));
      const bulanIni = state.kas.filter((k) => {
        const kd = new Date(k.date);
        return kd.getMonth() === d.getMonth() && kd.getFullYear() === d.getFullYear();
      });
      const masuk = bulanIni.filter((k) => k.tipe === 'Pemasukan').reduce((s, k) => s + k.nominal, 0);
      const keluarProyek = bulanIni
        .filter((k) => k.tipe !== 'Pemasukan' && k.tipe !== 'Penarikan')
        .reduce((s, k) => s + k.nominal, 0);
      const tarik = bulanIni.filter((k) => k.tipe === 'Penarikan').reduce((s, k) => s + k.nominal, 0);
      savingBuckets.push(Math.max(0, masuk - keluarProyek));
      tarikBuckets.push(tarik);
    }

    // Analisa keperluan tarik kas (peruntukan) periode yang sama dengan grafik
    const periodStart = new Date(now.getFullYear(), now.getMonth() - (BULAN_TAMPIL - 1), 1);
    const tarikPeriod = state.kas.filter((k) => k.tipe === 'Penarikan' && new Date(k.date) >= periodStart);
    const kategoriSum = {};
    for (const k of tarikPeriod) {
      const kat = kategoriTarik(k.ket);
      if (!kategoriSum[kat.key]) kategoriSum[kat.key] = { ...kat, total: 0, count: 0 };
      kategoriSum[kat.key].total += k.nominal || 0;
      kategoriSum[kat.key].count++;
    }
    const totalTarikPeriod = tarikPeriod.reduce((s, k) => s + (k.nominal || 0), 0);
    const kategoriRows = Object.values(kategoriSum).sort((a, b) => b.total - a.total);
    const maxKategoriTotal = kategoriRows[0]?.total || 1;
    const analisaEl = this.el.querySelector('[data-tarik-analisa]');
    if (analisaEl) {
      analisaEl.innerHTML = kategoriRows.length
        ? kategoriRows
            .map((r) => {
              const pct = totalTarikPeriod ? Math.round((r.total / totalTarikPeriod) * 100) : 0;
              const width = Math.max(4, Math.round((r.total / maxKategoriTotal) * 100));
              return `
              <div class="min-w-0">
                <div class="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span class="flex min-w-0 items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                    <i class="fa-solid ${r.icon} w-3.5 shrink-0 text-center text-slate-400"></i>
                    <span class="truncate">${r.label}</span>
                    <span class="shrink-0 text-slate-400">(${r.count}x)</span>
                  </span>
                  <span class="shrink-0 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">${formatRp(r.total)} <span class="font-normal text-slate-400">· ${pct}%</span></span>
                </div>
                <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-1.5 rounded-full ${r.bar}" style="width:${width}%"></div></div>
              </div>`;
            })
            .join('')
        : `<p class="text-xs text-slate-400">Belum ada penarikan kas 3 bulan terakhir.</p>`;
    }

    const dark = document.documentElement.classList.contains('dark');
    if (chart) chart.destroy();
    // Gradasi vertikal untuk batang (gaya dashboard modern)
    const ctx = canvas.getContext('2d');
    const grad = (from, to) => {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 208);
      g.addColorStop(0, from);
      g.addColorStop(1, to);
      return g;
    };
    chart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Saving Loket',
            data: savingBuckets,
            backgroundColor: grad('#34d399', 'rgba(34, 160, 107, 0.55)'),
            hoverBackgroundColor: grad('#6ee7b7', 'rgba(34, 160, 107, 0.75)'),
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 30,
          },
          {
            label: 'Tarik Kas',
            data: tarikBuckets,
            backgroundColor: grad('#fbbf24', 'rgba(232, 163, 61, 0.5)'),
            hoverBackgroundColor: grad('#fcd34d', 'rgba(232, 163, 61, 0.7)'),
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 30,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: dark ? 'rgba(11, 15, 28, .95)' : 'rgba(255,255,255,.98)',
            titleColor: dark ? '#e2e8f0' : '#0f172a',
            bodyColor: dark ? '#cbd5e1' : '#334155',
            borderColor: dark ? 'rgba(255,255,255,.1)' : '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 12,
            displayColors: true,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: { label: (c) => ` ${c.dataset.label}: ${formatRp(c.raw)}` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: dark ? '#8b93ad' : '#64748b', font: { weight: '600' } },
          },
          y: {
            grid: { color: dark ? 'rgba(255,255,255,.05)' : '#eef1f6' },
            border: { display: false },
            ticks: { color: dark ? '#8b93ad' : '#64748b', callback: (v) => formatRpShort(v) },
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
  else if (a.startsWith('step:')) goToPermohonan({ status: 'Lunas', step: a.split(':')[1] });
  else if (a.startsWith('open-perm:')) goToPermohonan({ q: a.split(':')[1] });
  else if (a.startsWith('nidi-tanda:')) goToPermohonan({ nidiTanda: a.split(':')[1] });
  else if (a.startsWith('saving:')) goToPermohonan({ saving: a.split(':')[1] });
  else if (a.startsWith('biaya:')) goToPermohonan({ biaya: a.split(':')[1] });
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
