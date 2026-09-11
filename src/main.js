import './style.css';
import Chart from 'chart.js/auto';
import { initTheme } from './ui/theme.js';
import { toast } from './ui/toast.js';
import { initStore, onChange } from './store.js';
import { dashboard } from './views/dashboard.js';
import { permohonan } from './views/permohonan.js';
import { kas } from './views/kas.js';
import { harga } from './views/harga.js';

window.Chart = Chart;

const LOGIN_KEY = 'isAdminLoggedIn';
const LOGIN = { user: 'admin', pass: 'admin' };

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', title: 'Dashboard', view: dashboard },
  { id: 'permohonan', label: 'Permohonan', icon: 'fa-file-signature', title: 'Permohonan & Loket', view: permohonan },
  { id: 'kas', label: 'Buku Kas', icon: 'fa-book', title: 'Buku Kas', view: kas },
  { id: 'harga', label: 'Daftar Harga', short: 'Harga', icon: 'fa-tags', title: 'Daftar Harga', view: harga },
];

const built = new Set();
let active = 'dashboard';

/* ---------- Navigation ---------- */
function renderNav() {
  const side = document.querySelector('[data-nav]');
  const bottom = document.querySelector('[data-bottom-nav]');
  side.innerHTML = NAV.map(
    (n) => `<a href="#${n.id}" data-navlink="${n.id}" class="nav-item"><i class="fa-solid ${n.icon}"></i> ${n.label}</a>`
  ).join('');
  bottom.innerHTML = `<div class="mx-auto grid max-w-md" style="grid-template-columns:repeat(${NAV.length},minmax(0,1fr))">
    ${NAV.map(
      (n) => `<button data-navlink="${n.id}" class="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-slate-400">
        <i class="fa-solid ${n.icon} text-lg"></i>${n.short || n.label}</button>`
    ).join('')}</div>`;

  document.querySelectorAll('[data-navlink]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(el.dataset.navlink);
    })
  );
}

function switchTab(id) {
  const nav = NAV.find((n) => n.id === id);
  if (!nav) return;
  active = id;

  document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.id !== `view-${id}`));
  document.querySelector('[data-page-title]').textContent = nav.title;

  document.querySelectorAll('[data-navlink]').forEach((el) => {
    const on = el.dataset.navlink === id;
    if (el.classList.contains('nav-item')) el.classList.toggle('active', on);
    else el.classList.toggle('text-pln-600', on), el.classList.toggle('dark:text-pln-400', on),
      el.classList.toggle('text-slate-400', !on);
  });

  const el = document.getElementById(`view-${id}`);
  if (!built.has(id)) {
    nav.view.build(el);
    built.add(id);
  } else {
    nav.view.syncControls?.();
  }
  nav.view.refresh();
  closeSidebar();
  document.querySelector('main')?.scrollTo(0, 0);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
}

/* ---------- Topbar: sapaan + tanggal ---------- */
function renderTopbar() {
  const now = new Date();
  const h = now.getHours();
  const sapa = h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
  const g = document.querySelector('[data-greeting]');
  if (g) g.textContent = `${sapa}, Admin Loket 👋`;
  const pill = document.querySelector('[data-today-pill] span');
  if (pill) {
    pill.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
  }
}

/* ---------- Sidebar (mobile) ---------- */
const openSidebar = () => {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('sidebar-backdrop').classList.remove('hidden');
};
const closeSidebar = () => {
  if (window.innerWidth >= 768) return;
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-backdrop').classList.add('hidden');
};

/* ---------- Auth ---------- */
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  const app = document.getElementById('app');
  app.classList.remove('hidden');
  app.classList.add('flex', 'md:h-[100dvh]', 'md:overflow-hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
  const initial = NAV.some((n) => n.id === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  switchTab(initial);
}

function initAuth() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    if (u === LOGIN.user && p === LOGIN.pass) {
      localStorage.setItem(LOGIN_KEY, 'true');
      err.classList.add('hidden');
      form.reset();
      showApp();
      toast('Login berhasil. Selamat datang!');
    } else {
      err.classList.remove('hidden');
    }
  });

  document.querySelectorAll('[data-logout]').forEach((b) =>
    b.addEventListener('click', () => {
      localStorage.removeItem(LOGIN_KEY);
      location.reload();
    })
  );

  if (localStorage.getItem(LOGIN_KEY) === 'true') showApp();
}

/* ---------- Boot ---------- */
initTheme();
renderNav();
renderTopbar();
initAuth();

document.querySelector('[data-open-sidebar]')?.addEventListener('click', openSidebar);
document.querySelector('[data-close-sidebar]')?.addEventListener('click', closeSidebar);
document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);

window.addEventListener('navigate', (e) => switchTab(e.detail));
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id && id !== active && NAV.some((n) => n.id === id) && !document.getElementById('app').classList.contains('hidden')) {
    switchTab(id);
  }
});

onChange(() => {
  for (const id of built) NAV.find((n) => n.id === id).view.refresh();
});

initStore().catch((err) => {
  console.error(err);
  toast('Gagal terhubung ke database.', 'error');
});
