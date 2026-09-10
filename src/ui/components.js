import { esc } from '../lib/format.js';

export const statCard = ({ label, value, icon, tone = 'pln', sub = '', onClick = '' }) => {
  const tones = {
    pln: 'bg-pln-500 text-white shadow-pln-500/30',
    gold: 'bg-gold-500 text-white shadow-gold-500/30',
    leaf: 'bg-leaf-500 text-white shadow-leaf-500/30',
    amber: 'bg-amber-500 text-white shadow-amber-500/30',
    red: 'bg-red-500 text-white shadow-red-500/30',
  };
  return `
    <div ${onClick ? `role="button" tabindex="0" data-action="${onClick}"` : ''}
      class="card flex items-center gap-4 p-4 transition-all ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover' : ''}">
      <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg shadow-lg ${tones[tone]}">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="min-w-0">
        <p class="truncate text-xs font-medium text-slate-500 dark:text-slate-400">${label}</p>
        <p class="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white">${value}</p>
        ${sub ? `<p class="text-[11px] text-slate-400">${sub}</p>` : ''}
      </div>
    </div>`;
};

export const emptyState = ({ icon = 'fa-inbox', title = 'Belum ada data', desc = '', action = '' }) => `
  <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div class="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xl text-slate-400 dark:bg-slate-800">
      <i class="fa-solid ${icon}"></i>
    </div>
    <p class="font-semibold text-slate-700 dark:text-slate-200">${title}</p>
    ${desc ? `<p class="mt-1 max-w-xs text-sm text-slate-400">${desc}</p>` : ''}
    ${action ? `<div class="mt-4">${action}</div>` : ''}
  </div>`;

export const skeletonRows = (n = 5) =>
  Array.from({ length: n })
    .map(
      () => `
      <div class="card flex items-center gap-3 p-4">
        <div class="skeleton h-10 w-10 rounded-xl"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-3.5 w-1/3"></div>
          <div class="skeleton h-3 w-2/3"></div>
        </div>
        <div class="skeleton h-8 w-16 rounded-lg"></div>
      </div>`
    )
    .join('');

export const skeletonCards = (n = 3) =>
  `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${Array.from({ length: n })
    .map(() => `<div class="card p-4"><div class="skeleton mb-3 h-12 w-12 rounded-xl"></div><div class="skeleton mb-2 h-3 w-1/2"></div><div class="skeleton h-5 w-2/3"></div></div>`)
    .join('')}</div>`;

// Filter chip aktif yang bisa dihapus
export const filterChip = (label, key) => `
  <button data-clear-filter="${key}"
    class="badge badge-blue gap-1.5 pr-1.5">
    ${esc(label)}
    <span class="grid h-4 w-4 place-items-center rounded-full bg-pln-500/20"><i class="fa-solid fa-xmark text-[9px]"></i></span>
  </button>`;

/**
 * Pasang formatter ribuan pada <input inputmode="numeric" data-rp>.
 * Nilai mentah tersedia via input.dataset.raw.
 */
export function bindRupiahInputs(root) {
  root.querySelectorAll('input[data-rp]').forEach((input) => {
    const format = () => {
      const raw = input.value.replace(/[^\d]/g, '');
      input.dataset.raw = raw;
      input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
    };
    if (input.value) format();
    input.addEventListener('input', format);
  });
}
