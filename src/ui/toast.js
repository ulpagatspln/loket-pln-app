const ICONS = {
  success: 'fa-circle-check text-leaf-400',
  error: 'fa-circle-exclamation text-red-300',
  info: 'fa-circle-info text-pln-300',
};

export function toast(message, type = 'success') {
  const host = document.getElementById('toast-host');
  if (!host) return;

  const el = document.createElement('div');
  el.className =
    'pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-pop ' +
    'translate-y-3 opacity-0 transition-all duration-300 ' +
    (type === 'error' ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-700');
  el.innerHTML = `<i class="fa-solid ${ICONS[type] || ICONS.success}"></i><span>${message}</span>`;
  host.appendChild(el);

  requestAnimationFrame(() => el.classList.remove('translate-y-3', 'opacity-0'));
  setTimeout(() => {
    el.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
