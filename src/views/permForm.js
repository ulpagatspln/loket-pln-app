import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { bindRupiahInputs } from '../ui/components.js';
import { state, createPermohonan, updatePermohonanWithProgress } from '../store.js';
import { parseNum, esc } from '../lib/format.js';

const val = (ctrl, sel) => ctrl.query(sel)?.value.trim() ?? '';

// Pisahkan ALAMAT GV ("<jalan> <kel>, <kec>, KAB. <kab>, <prov>") sebisanya.
function splitAlamat(alamat = '') {
  const parts = alamat.split(',').map((s) => s.trim()).filter(Boolean);
  const out = { alamat, kelurahan: '', kecamatan: '', kabupaten: '', provinsi: '' };
  if (parts.length >= 3) {
    out.provinsi = parts.at(-1);
    out.kabupaten = parts.at(-2).replace(/^(KAB\.?|KOTA)\s*/i, '').trim();
    out.kecamatan = parts.at(-3);
    if (parts.length >= 4) out.kelurahan = parts.at(-4).split(/\s{2,}|\s(?=\S+$)/).at(-1);
    out.alamat = parts.slice(0, Math.max(1, parts.length - 3)).join(', ');
  }
  return out;
}

/**
 * openPermForm()                      -> tambah baru kosong
 * openPermForm('REQ-123')             -> edit
 * openPermForm(null, gvRow)           -> tambah baru, prefill dari data GV
 */
export function openPermForm(id = null, gv = null) {
  const p = id ? state.permohonan.find((x) => x.id === id) : null;
  const isEdit = !!p;
  const prefill = gv
    ? (() => {
        const a = splitAlamat(gv.alamat);
        return {
          nama: gv.nama || '',
          alamat: a.alamat,
          kelurahan: a.kelurahan,
          kecamatan: a.kecamatan,
          kabupaten: a.kabupaten,
          provinsi: a.provinsi,
          jenis: /PERUBAHAN DAYA/i.test(gv.jenis) ? 'Tambah Daya' : 'Pasang Baru',
          tarif: gv.tarif || '',
          daya: gv.daya || '',
          dayaLama: gv.dayaLama || '',
          biaya: gv.biaya || '',
          noAgenda: gv.noAgenda || '',
          idpel: gv.idpel || '',
        };
      })()
    : null;

  openModal({
    size: 'xl',
    title: isEdit ? 'Edit Data Permohonan' : prefill ? 'Buat Permohonan dari Data GV' : 'Tambah Permohonan Baru',
    body: `
      <div data-step="1">
        ${
          prefill
            ? `<div class="mb-4 rounded-xl border border-pln-200 bg-pln-50 p-3 text-xs dark:border-pln-900/50 dark:bg-pln-950/30">
                 <p class="font-bold text-pln-700 dark:text-pln-300"><i class="fa-solid fa-wand-magic-sparkles"></i> Terisi otomatis dari GV</p>
                 <p class="mt-1 text-pln-700/80 dark:text-pln-300/80">
                   Agenda <b>${esc(prefill.noAgenda)}</b>${prefill.idpel ? ` &middot; IDPEL <b>${esc(prefill.idpel)}</b>` : ''}${gv.telp ? ` &middot; Telp ${esc(gv.telp)}` : ''}<br>
                   Lengkapi <b>NIK</b> dan periksa alamat sebelum menyimpan.
                 </p>
               </div>`
            : ''
        }
        <div class="mb-4 flex items-center gap-2 text-xs font-semibold">
          <span data-dot="1" class="flex items-center gap-1.5 rounded-full bg-pln-500/10 px-2.5 py-1 text-pln-600 dark:text-pln-300"><span class="grid h-4 w-4 place-items-center rounded-full bg-pln-500 text-[10px] text-white">1</span> Data Pelanggan</span>
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
          <span data-dot="2" class="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-400 dark:bg-slate-800"><span class="grid h-4 w-4 place-items-center rounded-full bg-slate-300 text-[10px] text-white dark:bg-slate-600">2</span> Layanan &amp; Biaya</span>
        </div>

        <div data-page="1" class="grid gap-3 sm:grid-cols-2">
          <div><label class="field-label">NIK *</label><input data-f="nik" inputmode="numeric" class="input" /></div>
          <div><label class="field-label">Nama Pelanggan *</label><input data-f="nama" class="input" /></div>
          <div class="sm:col-span-2"><label class="field-label">Alamat Lengkap *</label><textarea data-f="alamat" rows="2" class="input"></textarea></div>
          <div><label class="field-label">Kelurahan</label><input data-f="kelurahan" class="input" /></div>
          <div><label class="field-label">Kecamatan</label><input data-f="kecamatan" class="input" /></div>
          <div><label class="field-label">Kabupaten</label><input data-f="kabupaten" class="input" /></div>
          <div><label class="field-label">Provinsi</label><input data-f="provinsi" class="input" /></div>
          <div><label class="field-label">Latitude</label><input data-f="lat" class="input" /></div>
          <div><label class="field-label">Longitude</label><input data-f="long" class="input" /></div>
        </div>

        <div data-page="2" class="hidden grid gap-3 sm:grid-cols-2">
          <div><label class="field-label">Jenis Layanan *</label>
            <select data-f="jenis" class="select">
              <option value="Pasang Baru">Pasang Baru (PB)</option>
              <option value="Tambah Daya">Tambah Daya (PD)</option>
            </select>
          </div>
          <div><label class="field-label">Tarif</label><input data-f="tarif" class="input" /></div>
          <div><label class="field-label">Unit</label><input value="ULP Agats" disabled class="input opacity-60" /></div>
          <div><label class="field-label">Daya Lama (VA) <span class="font-normal text-slate-400">— untuk Tambah Daya</span></label><input data-f="dayaLama" inputmode="numeric" class="input" /></div>
          <div><label class="field-label">Daya (VA) *</label><input data-f="daya" inputmode="numeric" class="input" /></div>
          <div class="sm:col-span-2"><label class="field-label">Biaya Total (Rp) *</label><input data-f="biaya" data-rp inputmode="numeric" class="input" /></div>
          ${
            isEdit
              ? `<div class="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                   <label class="mb-1 block text-xs font-bold text-red-700 dark:text-red-400"><i class="fa-solid fa-clock-rotate-left"></i> Edit Progres (Rollback)</label>
                   <select data-f="prog" class="select border-red-300 font-semibold text-red-700 dark:border-red-800 dark:text-red-400">
                     <option value="menunggu">Menunggu Pembayaran</option>
                     <option value="step-0">Lunas - Belum PPOB (Tahap 1)</option>
                     <option value="step-1">Lunas - Belum Pasang (Tahap 2)</option>
                     <option value="step-2">Lunas - Belum FSO (Tahap 3)</option>
                     <option value="step-3">Lunas - Belum AP2T (Tahap 4)</option>
                     <option value="step-4">Lunas - Belum Bayar NIDI (Tahap 5)</option>
                     <option value="step-5">Lunas - Belum Upload Berkas (Tahap 6)</option>
                     <option value="selesai">Selesai 100%</option>
                   </select>
                   <p class="mt-1 text-[10px] leading-tight text-red-600 dark:text-red-400">Rollback ke tahap sebelumnya akan otomatis menghapus riwayat pengeluaran kas di tahap tersebut.</p>
                 </div>`
              : ''
          }
        </div>
      </div>`,
    footer: `
      <div class="flex gap-2">
        <button data-back class="btn btn-ghost hidden flex-1"><i class="fa-solid fa-arrow-left"></i> Kembali</button>
        <button data-cancel class="btn btn-ghost flex-1">Batal</button>
        <button data-next class="btn btn-primary flex-1">Lanjut <i class="fa-solid fa-arrow-right"></i></button>
        <button data-save class="btn btn-primary hidden flex-1"><i class="fa-solid fa-check"></i> Simpan</button>
      </div>`,
    onMount: (ctrl) => {
      bindRupiahInputs(ctrl.root);
      if (isEdit) {
        const map = ['nik', 'nama', 'alamat', 'kelurahan', 'kecamatan', 'kabupaten', 'provinsi', 'lat', 'long', 'jenis', 'tarif', 'daya', 'dayaLama'];
        map.forEach((k) => {
          const el = ctrl.query(`[data-f="${k}"]`);
          if (el) el.value = p[k] ?? '';
        });
        const biaya = ctrl.query('[data-f="biaya"]');
        biaya.value = p.biaya ? Number(p.biaya).toLocaleString('id-ID') : '';
        biaya.dataset.raw = p.biaya ?? '';
        ctrl.query('[data-f="prog"]').value =
          p.status === 'Selesai' ? 'selesai' : p.status === 'Lunas' ? `step-${p.step}` : 'menunggu';
      } else if (prefill) {
        ['nama', 'alamat', 'kelurahan', 'kecamatan', 'kabupaten', 'provinsi', 'tarif', 'daya', 'dayaLama'].forEach((k) => {
          const el = ctrl.query(`[data-f="${k}"]`);
          if (el && prefill[k]) el.value = prefill[k];
        });
        ctrl.query('[data-f="jenis"]').value = prefill.jenis;
        const biaya = ctrl.query('[data-f="biaya"]');
        if (prefill.biaya) {
          biaya.value = Number(prefill.biaya).toLocaleString('id-ID');
          biaya.dataset.raw = String(prefill.biaya);
        }
      }

      const pages = { 1: ctrl.query('[data-page="1"]'), 2: ctrl.query('[data-page="2"]') };
      const dots = { 1: ctrl.query('[data-dot="1"]'), 2: ctrl.query('[data-dot="2"]') };
      const btn = {
        back: ctrl.query('[data-back]'),
        cancel: ctrl.query('[data-cancel]'),
        next: ctrl.query('[data-next]'),
        save: ctrl.query('[data-save]'),
      };
      let page = 1;

      const show = (n) => {
        page = n;
        pages[1].classList.toggle('hidden', n !== 1);
        pages[2].classList.toggle('hidden', n !== 2);
        btn.back.classList.toggle('hidden', n === 1);
        btn.cancel.classList.toggle('hidden', n !== 1);
        btn.next.classList.toggle('hidden', n === 2);
        btn.save.classList.toggle('hidden', n !== 2);
        dots[2].className = n === 2
          ? 'flex items-center gap-1.5 rounded-full bg-pln-500/10 px-2.5 py-1 text-pln-600 dark:text-pln-300'
          : 'flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-400 dark:bg-slate-800';
      };

      btn.cancel.addEventListener('click', ctrl.close);
      btn.back.addEventListener('click', () => show(1));
      btn.next.addEventListener('click', () => {
        if (!val(ctrl, '[data-f="nik"]') || !val(ctrl, '[data-f="nama"]') || !val(ctrl, '[data-f="alamat"]')) {
          return toast('Lengkapi NIK, Nama, dan Alamat.', 'error');
        }
        show(2);
      });
      btn.save.addEventListener('click', async () => {
        const daya = val(ctrl, '[data-f="daya"]');
        const biaya = parseNum(ctrl.query('[data-f="biaya"]').dataset.raw);
        if (!daya || !biaya) return toast('Lengkapi Daya dan Biaya Total.', 'error');

        const fields = {
          nik: val(ctrl, '[data-f="nik"]'),
          nama: val(ctrl, '[data-f="nama"]'),
          alamat: val(ctrl, '[data-f="alamat"]'),
          jenis: ctrl.query('[data-f="jenis"]').value,
          kelurahan: val(ctrl, '[data-f="kelurahan"]'),
          kecamatan: val(ctrl, '[data-f="kecamatan"]'),
          kabupaten: val(ctrl, '[data-f="kabupaten"]'),
          provinsi: val(ctrl, '[data-f="provinsi"]'),
          lat: val(ctrl, '[data-f="lat"]'),
          long: val(ctrl, '[data-f="long"]'),
          tarif: val(ctrl, '[data-f="tarif"]'),
          dayaLama: val(ctrl, '[data-f="dayaLama"]'),
          daya,
          biaya,
        };
        if (prefill) {
          if (prefill.noAgenda) fields.noAgenda = prefill.noAgenda;
          if (prefill.idpel) fields.idpel = prefill.idpel;
        }

        btn.save.disabled = true;
        btn.save.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan';
        try {
          if (isEdit) {
            await updatePermohonanWithProgress(id, fields, ctrl.query('[data-f="prog"]').value);
            toast('Data & progres diperbarui.');
          } else {
            await createPermohonan(fields);
            toast(prefill ? 'Permohonan dibuat dari data GV.' : 'Permohonan ditambahkan.');
          }
          ctrl.close();
        } catch (e) {
          btn.save.disabled = false;
          btn.save.innerHTML = '<i class="fa-solid fa-check"></i> Simpan';
          toast('Gagal menyimpan. Coba lagi.', 'error');
        }
      });

      show(1);
    },
  });
}
