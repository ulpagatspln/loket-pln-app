import { esc } from '../lib/format.js';

export const statCard = ({ label, value, icon, tone = 'pln', sub = '', onClick = '' }) => {
  const tones = {
    pln: 'icon-pln',
    iris: 'icon-iris',
    gold: 'icon-gold',
    leaf: 'icon-leaf',
    amber: 'icon-gold',
    red: 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_10px_26px_-10px_rgba(244,63,94,.7)]',
  };
  return `
    <div ${onClick ? `role="button" tabindex="0" data-action="${onClick}"` : ''}
      class="card group relative overflow-hidden p-4 transition-all ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover' : ''}">
      <div class="flex items-center gap-3.5">
        <div class="icon-badge ${tones[tone] || tones.pln} h-11 w-11 text-base">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">${label}</p>
          <p class="mt-1 whitespace-nowrap text-lg font-extrabold tabular-nums text-slate-900 dark:text-white xl:text-xl">${value}</p>
          ${sub ? `<p class="mt-0.5 text-[10px] leading-tight text-slate-400">${sub}</p>` : ''}
        </div>
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
  `<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${Array.from({ length: n })
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
