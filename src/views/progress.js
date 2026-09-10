import { openModal, openImageViewer } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { bindRupiahInputs } from '../ui/components.js';
import {
  state, calculateSaldo, PROGRESS_STEPS,
  completeStepWithCost, completeStepBerkas, advanceStep,
} from '../store.js';
import { formatRp, parseNum, esc } from '../lib/format.js';
import { compressImage, savePhoto, getPhoto } from '../lib/imageStore.js';
import { hargaTotalUntuk, rincianDana } from '../lib/harga.js';

// Folder GDrive lama - hanya dipakai untuk tahap yang masih pakai link (step 5)
const GDRIVE = {
  5: 'https://drive.google.com/drive/folders/1jaXRZhCgj8aMzxTx4MW-CCDv1Q3UWBcj?usp=sharing',
};
const COST_NAME = {
  0: 'Biaya Pembayaran BP di PPOB',
  1: 'Biaya Pemasangan di Lokasi',
  4: 'Biaya Pembayaran NIDI & SLO',
};
const PHOTO_LABEL = {
  0: 'Foto Bukti Pembayaran PPOB',
  1: 'Foto Bukti Pemasangan',
};

export function openProgressModal(id) {
  let ctrl;
  const photos = {}; // { [stepIndex]: { dataUrl, bytes } }

  const trxOfStep = (p, i) =>
    state.kas.find(
      (k) =>
        k.refId === p.id &&
        (i === 0 ? k.ket.includes('PPOB') : i === 1 ? k.ket.includes('Pemasangan') : i === 4 ? k.ket.includes('NIDI') : false)
    );

  const renderBody = () => {
    const p = state.permohonan.find((x) => x.id === id);
    if (!p) return '';
    const steps = PROGRESS_STEPS.map((label, i) => {
      const done = p.step > i || p.status === 'Selesai';
      const active = p.step === i && p.status !== 'Selesai';
      const line = i < PROGRESS_STEPS.length - 1;

      const dot = done
        ? 'border-leaf-500 bg-leaf-500 text-white'
        : active
        ? 'border-pln-500 text-pln-600 dark:text-pln-400'
        : 'border-slate-300 text-slate-300 dark:border-slate-600 dark:text-slate-600';
      const txt = done
        ? 'font-bold text-slate-900 dark:text-white'
        : active
        ? 'font-bold text-pln-700 dark:text-pln-400'
        : 'text-slate-400';

      let detail = '';
      if (done) {
        if (i === 0 && p.noAgenda) detail += info('fa-hashtag', 'Agenda', p.noAgenda);
        if (i === 1 && p.namaPemasang) detail += info('fa-hard-hat', 'Pemasang', p.namaPemasang);
        const trx = trxOfStep(p, i);
        if (trx?.nominal)
          detail += `<p class="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400"><i class="fa-solid fa-money-bill-wave mr-1"></i>Biaya: ${formatRp(trx.nominal)}</p>`;
        if (trx?.buktiId) detail += thumb(trx.buktiId, `${label} - ${p.nama}`);
        else if (trx?.link) detail += linkBtn(trx.link, 'Cek Bukti GDrive');
        if (i === 5 && p.linkNidiSlo) detail += linkBtn(p.linkNidiSlo, 'Cek Berkas GDrive');
      }

      let form = '';
      if (active) {
        if ([0, 1, 4, 5].includes(i)) {
          form = `<div class="mt-3 space-y-2.5 rounded-xl border border-pln-200 bg-pln-50 p-3 dark:border-pln-900/50 dark:bg-pln-950/30">`;
          if (i === 0) form += fieldText('agenda', 'Nomor Agenda *', p.noAgenda || '');
          if (i === 1) form += fieldText('pemasang', 'Nama Pemasang di Lokasi *');
          if ([0, 1].includes(i)) form += photoField(i);
          if (i === 5) {
            form += `<div class="flex items-end justify-between">
              <label class="field-label mb-0">Link Upload Berkas (GDrive) *</label>
              <a href="${GDRIVE[5]}" target="_blank" rel="noopener" class="text-[11px] font-medium text-pln-600 hover:underline dark:text-pln-400"><i class="fa-solid fa-folder-open"></i> Buka Folder</a>
            </div><input data-link class="input" />`;
          }
          if ([0, 1, 4].includes(i)) {
            form += `<label class="field-label">Biaya Pengeluaran Kas (Rp) *</label><input data-cost data-rp inputmode="numeric" class="input" />`;
          }
          form += `<button data-do="${i}" class="btn btn-primary mt-1 w-full"><i class="fa-solid fa-check"></i> Selesaikan Tahap</button></div>`;
        } else {
          form = `<button data-do="${i}" class="btn btn-primary btn-sm mt-2"><i class="fa-solid fa-check"></i> Selesaikan Tahap Ini</button>`;
        }
      }

      return `
        <div class="relative pb-7 pl-9">
          ${line ? `<span class="absolute left-[13px] top-7 h-full w-0.5 ${done ? 'bg-leaf-500' : 'bg-slate-200 dark:bg-slate-700'}"></span>` : ''}
          <span class="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full border-2 bg-white text-xs dark:bg-slate-900 ${dot}">
            ${done ? '<i class="fa-solid fa-check"></i>' : active ? '<span class="h-2 w-2 rounded-full bg-pln-500"></span>' : ''}
          </span>
          <p class="text-sm ${txt}">${label}</p>
          ${detail}
          ${form}
        </div>`;
    }).join('');

    const p2 = state.permohonan.find((x) => x.id === id);
    const badges = [];
    if (p2.asalMohon)
      badges.push(`<span class="badge bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"><i class="fa-solid fa-${/MOBILE/i.test(p2.asalMohon) ? 'mobile-screen-button' : 'store'}"></i> ${esc(p2.asalMohon)}</span>`);
    if (p2.statusPermohonan)
      badges.push(`<span class="badge bg-gold-500/15 text-gold-600 dark:text-gold-400">${esc(p2.statusPermohonan)}</span>`);
    const h = hargaTotalUntuk(p2, state.harga, state.hargaTd);
    if (h) {
      const d = Number(p2.biaya || 0) - h.total;
      const tip = `Daftar harga ${h.kind} ${h.rt ? 'RT' : 'Selain RT'}: ${formatRp(h.total)}`;
      badges.push(
        d === 0
          ? `<span title="${tip}" class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Biaya pas daftar harga</span>`
          : d < 0
          ? `<span title="${tip}" class="badge bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"><i class="fa-solid fa-arrow-down"></i> Biaya kurang ${formatRp(-d)}</span>`
          : `<span title="${tip}" class="badge bg-pln-500/15 text-pln-700 dark:text-pln-300"><i class="fa-solid fa-arrow-up"></i> Biaya lebih ${formatRp(d)}</span>`
      );
    }
    const gv = badges.length ? `<div class="mt-2 flex flex-wrap gap-1">${badges.join('')}</div>` : '';
    return `
      <div class="mb-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Detail Permohonan</p>
        <h4 class="text-base font-bold text-slate-900 dark:text-white">${esc(p2.nama)}</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400">${esc(p2.jenis)} - ${esc(p2.daya)} VA${p2.noAgenda ? ` · Agenda ${esc(p2.noAgenda)}` : ''}</p>
        ${gv}
      </div>
      ${rincianDanaHtml(p2)}
      <div>${steps}</div>`;
  };

  const photoField = (i) => {
    const chosen = photos[i];
    return `
      <div>
        <label class="field-label">${PHOTO_LABEL[i]} *</label>
        <div data-photo-slot="${i}">
          ${
            chosen
              ? photoPreview(i, chosen)
              : `<label class="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-pln-300 bg-white px-3 py-5 text-center text-sm font-medium text-pln-600 transition-colors hover:bg-pln-50 dark:border-pln-800 dark:bg-slate-900 dark:text-pln-400 dark:hover:bg-slate-800">
                   <i class="fa-solid fa-camera text-xl"></i>
                   Ambil / Pilih Foto
                   <span class="text-[10px] font-normal text-slate-400">Otomatis dikompres sebelum disimpan</span>
                   <input data-photo="${i}" type="file" accept="image/*" capture="environment" class="hidden" />
                 </label>`
          }
        </div>
      </div>`;
  };

  const photoPreview = (i, { dataUrl, bytes }) => `
    <div class="flex items-center gap-3 rounded-lg border border-pln-200 bg-white p-2 dark:border-pln-900/50 dark:bg-slate-900">
      <img src="${dataUrl}" class="h-16 w-16 shrink-0 rounded-md object-cover" alt="Pratinjau" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-leaf-600 dark:text-leaf-400"><i class="fa-solid fa-circle-check"></i> Foto siap</p>
        <p class="text-[11px] text-slate-400">${(bytes / 1024).toFixed(0)} KB setelah kompres</p>
      </div>
      <label class="btn btn-ghost btn-sm cursor-pointer">
        Ganti<input data-photo="${i}" type="file" accept="image/*" capture="environment" class="hidden" />
      </label>
    </div>`;

  const wire = () => {
    bindRupiahInputs(ctrl.root);
    ctrl.root.querySelectorAll('[data-do]').forEach((b) => {
      b.addEventListener('click', () => handle(parseInt(b.dataset.do, 10), b));
    });
    ctrl.root.querySelectorAll('[data-photo]').forEach((inp) => {
      inp.addEventListener('change', () => onPickPhoto(parseInt(inp.dataset.photo, 10), inp.files[0]));
    });
    ctrl.root.querySelectorAll('[data-view-bukti]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const src = await getPhoto(btn.dataset.viewBukti);
        btn.disabled = false;
        if (src) openImageViewer(src, btn.dataset.caption || '');
        else toast('Foto tidak ditemukan.', 'error');
      });
    });
    hydrateThumbs();
  };

  async function hydrateThumbs() {
    for (const img of ctrl.root.querySelectorAll('img[data-bukti-id]')) {
      const src = await getPhoto(img.dataset.buktiId);
      if (src) img.src = src;
      else img.closest('[data-thumb]')?.remove();
    }
  }

  async function onPickPhoto(i, file) {
    if (!file) return;
    const slot = ctrl.root.querySelector(`[data-photo-slot="${i}"]`);
    const restore = () => {
      const tmp = document.createElement('div');
      tmp.innerHTML = photoField(i);
      slot.innerHTML = tmp.querySelector(`[data-photo-slot="${i}"]`).innerHTML;
      slot.querySelectorAll('[data-photo]').forEach((inp) =>
        inp.addEventListener('change', (e) => onPickPhoto(i, e.target.files[0]))
      );
    };
    slot.innerHTML = `<div class="flex items-center gap-2 rounded-lg border border-pln-200 bg-white p-3 text-sm text-slate-500 dark:border-pln-900/50 dark:bg-slate-900">
      <i class="fa-solid fa-spinner fa-spin text-pln-500"></i> Mengompres foto...</div>`;
    try {
      photos[i] = await compressImage(file);
      restore();
    } catch (err) {
      delete photos[i];
      toast(err.message || 'Gagal memproses foto.', 'error');
      restore();
    }
  }

  const rerender = () => {
    ctrl.query('[data-body]').innerHTML = renderBody();
    wire();
  };

  async function handle(i, btn) {
    const p = state.permohonan.find((x) => x.id === id);
    if (!p || p.step !== i) return;
    const q = (s) => ctrl.root.querySelector(s);

    const payload = {};
    if (i === 0) {
      payload.agenda = q('[data-f="agenda"]')?.value.trim();
      if (!payload.agenda) return toast('Masukkan Nomor Agenda.', 'error');
    }
    if (i === 1) {
      payload.pemasang = q('[data-f="pemasang"]')?.value.trim();
      if (!payload.pemasang) return toast('Masukkan Nama Pemasang.', 'error');
    }
    if ([0, 1].includes(i) && !photos[i]) return toast('Ambil / pilih foto bukti dulu.', 'error');
    if (i === 5) {
      payload.link = q('[data-link]')?.value.trim();
      if (!payload.link) return toast('Masukkan link GDrive.', 'error');
    }
    if ([0, 1, 4].includes(i)) {
      payload.cost = parseNum(q('[data-cost]')?.dataset.raw);
      if (!payload.cost || payload.cost <= 0) return toast('Masukkan biaya pengeluaran.', 'error');
      if (calculateSaldo() < payload.cost) return toast('Saldo kas tidak mencukupi!', 'error');
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    try {
      if ([0, 1].includes(i)) {
        payload.buktiId = await savePhoto(photos[i].dataUrl, {
          ket: COST_NAME[i],
          refId: id,
          step: i,
        });
      }
      if (i === 5) await completeStepBerkas(id, i, payload.link);
      else if ([0, 1, 4].includes(i)) await completeStepWithCost(id, i, COST_NAME[i], payload);
      else await advanceStep(id, i);
      delete photos[i];
      toast('Tahap selesai dan disimpan.');
      rerender();
    } catch (e) {
      console.error(e);
      toast('Gagal memproses. Coba lagi.', 'error');
      rerender();
    }
  }

  ctrl = openModal({
    size: 'md',
    title: 'Monitoring Progres',
    body: renderBody(),
    onMount: (c) => {
      ctrl = c;
      wire();
    },
  });
}

const info = (icon, label, value) =>
  `<p class="mt-1 text-xs text-slate-600 dark:text-slate-400"><i class="fa-solid ${icon} mr-1"></i>${label}: <span class="font-bold text-slate-900 dark:text-white">${esc(value)}</span></p>`;

const linkBtn = (href, label) =>
  `<a href="${esc(href)}" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${label}</a>`;

const thumb = (buktiId, caption) => `
  <button type="button" data-view-bukti="${esc(buktiId)}" data-caption="${esc(caption)}" data-thumb
    class="group relative mt-2 block h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
    <img data-bukti-id="${esc(buktiId)}" alt="Bukti" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
    <span class="absolute inset-0 grid place-items-center bg-slate-900/0 text-white/0 transition-colors group-hover:bg-slate-900/40 group-hover:text-white">
      <i class="fa-solid fa-magnifying-glass-plus"></i>
    </span>
  </button>`;

const fieldText = (name, label, value = '') =>
  `<label class="field-label">${label}</label><input data-f="${name}" class="input" value="${esc(value)}" />`;

function rincianDanaHtml(p) {
  const d = rincianDana(p, state.kas, state.harga, state.hargaTd);
  if (!d) return '';
  const row = (label, txt, strong = false) => `
    <div class="flex items-center justify-between py-1 text-xs ${strong ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}">
      <span>${label}</span><span class="tabular-nums">${txt}</span>
    </div>`;
  const belum = '<span class="text-[11px] italic text-slate-400">belum dibayar</span>';

  let body = row('Dibayar pelanggan', formatRp(d.masuk));
  body += row('− PPOB (BP)', d.ppob ? `−${formatRp(d.ppob)}` : belum);
  if (d.jasaPasangPaid) body += row('− Jasa pasang', `−${formatRp(d.jasaPasangPaid)}`);
  if (d.nidiPaid) body += row('− NIDI + SLO', `−${formatRp(d.nidiPaid)}`);
  const rp = (n) => (n < 0 ? '−' + formatRp(-n) : formatRp(n));
  body += `<div class="my-1 border-t border-slate-200 dark:border-slate-700"></div>`;
  body += row('Sisa di loket', rp(d.sisa), true);

  let alloc = '';
  if (d.alokJasa || d.alokNidi) {
    alloc = `<p class="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Rencana alokasi sisa</p>`;
    if (d.alokJasa) alloc += row('− Jasa pasang (belum dibayar)', `−${formatRp(d.alokJasa)}`);
    if (d.alokNidi) alloc += row('− NIDI + SLO (belum dibayar)', `−${formatRp(d.alokNidi)}`);
  }
  const ada = d.saving > 0;
  const savingBox = ada
    ? 'bg-leaf-500/10 text-leaf-700 dark:text-leaf-400'
    : 'bg-slate-100 text-slate-400 dark:bg-slate-800';
  const note = !d.ref
    ? `<p class="mt-1.5 text-[10px] italic text-slate-400">Kombinasi daya tidak ada di daftar harga — alokasi jasa pasang / NIDI+SLO tidak dihitung.</p>`
    : d.savingRaw < 0
    ? `<p class="mt-1.5 text-[10px] italic text-slate-400">Dana kurang ${formatRp(-d.savingRaw)} untuk menutup alokasi — saving dianggap Rp 0.</p>`
    : '';

  const warnNidi = d.ref?.kind === 'Pasang Baru' && d.nidiBelum && d.sisa <= 0;
  const warn = warnNidi
    ? `<div class="mt-1.5 flex items-center gap-2 rounded-lg bg-amber-100 px-2.5 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
         <i class="fa-solid fa-triangle-exclamation"></i> Belum ada biaya NIDI+SLO — dana di loket tidak cukup, perlu tarik biaya NIDI+SLO dari pelanggan.
       </div>`
    : '';

  return `
    <div class="mb-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p class="mb-1 text-xs font-bold text-slate-800 dark:text-slate-100"><i class="fa-solid fa-wallet text-pln-500"></i> Rincian Dana Loket</p>
      ${body}
      ${alloc}
      <div class="mt-1.5 flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-extrabold ${savingBox}">
        <span>Saving Loket</span><span class="tabular-nums">${ada ? formatRp(d.saving) : 'Rp 0 · tidak ada saving'}</span>
      </div>
      ${warn}
      ${note}
    </div>`;
}
