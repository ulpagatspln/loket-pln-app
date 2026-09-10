import { openModal } from './modal.js';

// Catatan: gate klien-sisi saja (sama seperti versi lama). Untuk keamanan nyata,
// pindahkan ke Firebase Auth + Firestore Security Rules.
const ADMIN_PASS = 'Agats@123';

export function requireAdmin(onOk) {
  openModal({
    size: 'sm',
    title: 'Otorisasi Admin',
    body: `
      <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Masukkan password admin untuk melanjutkan tindakan pada data ini.
      </p>
      <input data-pass type="password" class="input" placeholder="Password admin" autocomplete="off" />
      <p data-err class="mt-2 hidden text-xs font-medium text-red-500">Password salah. Coba lagi.</p>`,
    footer: `
      <div class="flex gap-2">
        <button data-cancel class="btn btn-ghost flex-1">Batal</button>
        <button data-ok class="btn btn-primary flex-1">Lanjutkan</button>
      </div>`,
    onMount: (ctrl) => {
      const input = ctrl.query('[data-pass]');
      const err = ctrl.query('[data-err]');
      setTimeout(() => input.focus(), 50);
      const submit = () => {
        if (input.value === ADMIN_PASS) {
          ctrl.close();
          onOk();
        } else {
          err.classList.remove('hidden');
          input.select();
        }
      };
      ctrl.query('[data-cancel]').addEventListener('click', ctrl.close);
      ctrl.query('[data-ok]').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    },
  });
}
