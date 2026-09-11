const KEY = 'loket-theme';

function apply(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#1B75BB');
  document.querySelectorAll('[data-theme-icon]').forEach((el) => {
    el.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
  document.querySelectorAll('[data-theme-label]').forEach((el) => {
    el.textContent = dark ? 'Mode Terang' : 'Mode Gelap';
  });
}

export function initTheme() {
  const saved = localStorage.getItem(KEY);
  const theme = saved || 'dark'; // default: mode gelap (bukan ikut preferensi sistem)
  apply(theme);

  document.querySelectorAll('[data-toggle-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      apply(next);
    });
  });
}
