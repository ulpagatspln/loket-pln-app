import { openModal } from './modal.js';
import { toast } from './toast.js';
import { esc } from '../lib/format.js';
import { updatePermohonan } from '../store.js';

// Penanda NIDI+SLO per permohonan (diisi manual, dicek satu per satu).
export const NIDI_TANDA = {
  titip: {
    label: 'Titip NIDI+SLO',
    short: 'Titip NIDI+SLO',
    icon: 'fa-hand-holding-dollar',
    badge: 'bg-leaf-500/15 text-leaf-700 dark:text-leaf-400',
  },
  tidak_titip: {
    label: 'Tidak Ada Titip NIDI+SLO',
    short: 'Tidak titip NIDI+SLO',
    icon: 'fa-circle-xmark',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  },
  tidak_perlu: {
    label: 'Tidak Perlu NIDI+SLO',
    short: 'Tidak perlu NIDI+SLO',
    hint: 'Tambah daya di 1 fasa yang sama',
    icon: 'fa-ban',
    badge: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  },
  dibayar: {
    label: 'NIDI+SLO Sudah Dibayar Loket',
    short: 'NIDI+SLO dibayar loket',
    hint: 'Terisi otomatis saat tahap bayar NIDI & SLO selesai',
    icon: 'fa-circle-check',
    badge: 'bg-pln-500/15 text-pln-700 dark:text-pln-300',
  },
};

/**
 * Chip penanda NIDI+SLO — jika belum ditandai tampil tombol putus-putus "Tanda NIDI+SLO".
 * Selalu bisa diklik (data-act="nidi-tanda") untuk membuka pemilih.
 */
export function nidiTandaChip(p) {
  const t = NIDI_TANDA[p.nidiTanda];
  if (t) {
    return `<button data-act="nidi-tanda" data-id="${esc(p.id)}" title="Ubah penanda NIDI+SLO" class="badge ${t.badge}"><i class="fa-solid ${t.icon}"></i> ${t.short}</button>`;
  }
  return `<button data-act="nidi-tanda" data-id="${esc(p.id)}" class="badge border border-dashed border-slate-300 text-slate-400 hover:border-pln-400 hover:text-pln-500 dark:border-slate-600"><i class="fa-solid fa-tag"></i> Tanda NIDI+SLO</button>`;
}

export function openNidiTandaPicker(p, onDone) {
  const cur = p.nidiTanda || '';
  openModal({
    size: 'sm',
    title: 'Penanda NIDI+SLO',
    body: `
      <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">${esc(p.nama)} · ${esc(p.jenis)} ${esc(p.daya)} VA${p.noAgenda ? ` · Agenda ${esc(p.noAgenda)}` : ''}</p>
      <div class="space-y-2">
        ${Object.entries(NIDI_TANDA)
          .map(
            ([k, t]) => `
          <button data-pick="${k}" class="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${
            cur === k
              ? 'border-pln-500 bg-pln-50 dark:bg-pln-950/30'
              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
          }">
            <i class="fa-solid ${t.icon} w-5 shrink-0 text-center text-pln-500"></i>
            <span class="flex-1">${t.label}${t.hint ? `<span class="block text-[11px] font-normal text-slate-400">${t.hint}</span>` : ''}</span>
            ${cur === k ? '<i class="fa-solid fa-check text-pln-500"></i>' : ''}
          </button>`
          )
          .join('')}
        ${cur ? `<button data-pick="" class="w-full rounded-xl border border-slate-200 p-2 text-center text-xs text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Hapus penanda</button>` : ''}
      </div>`,
    onMount: (ctrl) => {
      ctrl.root.querySelectorAll('[data-pick]').forEach((b) => {
        b.addEventListener('click', async () => {
          const val = b.dataset.pick;
          ctrl.root.querySelectorAll('[data-pick]').forEach((x) => (x.disabled = true));
          try {
            await updatePermohonan(p.id, { nidiTanda: val });
            toast(val ? 'Penanda NIDI+SLO disimpan.' : 'Penanda dihapus.');
            ctrl.close();
            onDone?.(val);
          } catch {
            ctrl.root.querySelectorAll('[data-pick]').forEach((x) => (x.disabled = false));
            toast('Gagal menyimpan.', 'error');
          }
        });
      });
    },
  });
}
