/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        // Identitas PLN
        pln: {
          50: '#eef7fc',
          100: '#d5ecf7',
          200: '#aed9ef',
          300: '#79c0e4',
          400: '#3ba1d3',
          500: '#1B75BB', // biru PLN utama
          600: '#175f9c',
          700: '#164d7e',
          800: '#173f66',
          900: '#153452',
          950: '#0e2138',
        },
        sky2: '#00AEEF', // biru muda PLN (aksen)
        gold: {
          400: '#FDB913',
          500: '#F7A600', // kuning PLN
          600: '#d98e00',
        },
        leaf: {
          400: '#A6CE39',
          500: '#8CC63F', // hijau PLN
          600: '#6fa32f',
        },
        surface: {
          light: '#f5f7fa',
          dark: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 8px 24px -6px rgba(15, 23, 42, 0.12)',
        pop: '0 20px 45px -12px rgba(15, 23, 42, 0.28)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        'scale-in': 'scale-in .18s ease-out',
        'slide-up': 'slide-up .28s cubic-bezier(.16,1,.3,1)',
        'sheet-up': 'sheet-up .3s cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};
