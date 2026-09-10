let openCount = 0;

/**
 * openModal({ title, body, footer, size, dismissible, onMount })
 *  - body/footer: HTML string atau HTMLElement
 *  - size: 'sm' | 'md' | 'lg' | 'xl'
 * Return: { close, root, query(sel) }
 */
export function openModal({ title = '', body = '', footer = '', size = 'md', dismissible = true, onMount } = {}) {
  const host = document.getElementById('modal-host');
  const sizeCls = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' }[size] || 'sm:max-w-md';

  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4';

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" data-panel
      class="flex max-h-[92dvh] w-full ${sizeCls} flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop
             animate-sheet-up dark:bg-slate-900 sm:rounded-2xl sm:animate-scale-in">
      ${
        title
          ? `<div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
               <h3 class="text-base font-bold text-slate-900 dark:text-white">${title}</h3>
               <button data-x class="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                 <i class="fa-solid fa-xmark"></i>
               </button>
             </div>`
          : ''
      }
      <div data-body class="flex-1 overflow-y-auto px-5 py-4"></div>
      <div data-footer class="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-slate-800 ${footer ? '' : 'hidden'}"></div>
    </div>`;

  const panel = overlay.querySelector('[data-panel]');
  const bodyEl = overlay.querySelector('[data-body]');
  const footerEl = overlay.querySelector('[data-footer]');

  const put = (target, content) => {
    if (content instanceof HTMLElement) target.appendChild(content);
    else target.innerHTML = content;
  };
  put(bodyEl, body);
  if (footer) put(footerEl, footer);

  const close = () => {
    overlay.classList.add('opacity-0');
    panel.style.transform = 'translateY(6px)';
    panel.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      if (--openCount === 0) document.body.style.overflow = '';
    }, 180);
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay && dismissible) close();
  });
  overlay.querySelector('[data-x]')?.addEventListener('click', close);

  host.appendChild(overlay);
  if (openCount++ === 0) document.body.style.overflow = 'hidden';

  const ctrl = { close, root: overlay, query: (sel) => overlay.querySelector(sel) };
  onMount?.(ctrl);
  return ctrl;
}

export function openImageViewer(src, caption = '') {
  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-[110] flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 animate-fade-in';
  overlay.innerHTML = `
    <button data-x class="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
      <i class="fa-solid fa-xmark text-lg"></i>
    </button>
    <img src="${src}" alt="${caption}" class="max-h-[82dvh] max-w-full rounded-lg object-contain shadow-pop" />
    ${caption ? `<p class="text-center text-sm text-slate-300">${caption}</p>` : ''}
    <a href="${src}" download="bukti.jpg" class="btn btn-outline btn-sm"><i class="fa-solid fa-download"></i> Unduh</a>`;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-x]')) close();
  });
  document.getElementById('modal-host').appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

export function confirmDialog({
  title = 'Konfirmasi',
  message = 'Yakin ingin melanjutkan?',
  confirmText = 'Ya, Lanjutkan',
  tone = 'danger',
  icon = 'fa-triangle-exclamation',
  onConfirm,
}) {
  const toneCls = tone === 'danger' ? 'btn-danger' : 'btn-primary';
  const iconWrap =
    tone === 'danger'
      ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
      : 'bg-pln-100 text-pln-600 dark:bg-pln-900/50 dark:text-pln-300';

  const m = openModal({
    size: 'sm',
    body: `
      <div class="text-center">
        <div class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full text-xl ${iconWrap}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <h3 class="mb-1.5 text-base font-bold text-slate-900 dark:text-white">${title}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">${message}</p>
      </div>`,
    footer: `
      <div class="flex gap-2">
        <button data-cancel class="btn btn-ghost flex-1">Batal</button>
        <button data-ok class="btn ${toneCls} flex-1">${confirmText}</button>
      </div>`,
    onMount: (ctrl) => {
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-ok]').addEventListener('click', async () => {
        const btn = ctrl.query('[data-ok]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await onConfirm?.();
          ctrl.close();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = confirmText;
        }
      });
    },
  });
  return m;
}
