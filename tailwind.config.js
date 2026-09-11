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
        // Aksen ungu untuk gradasi & highlight (gaya dashboard modern)
        iris: {
          300: '#b9a8ff',
          400: '#9d85ff',
          500: '#7c5cfc',
          600: '#6a45ec',
          700: '#5733c9',
        },
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
        // Ujung gelap skala slate di-remap ke nuansa navy dashboard.
        // Semua komponen memakai slate-700/800/900, jadi satu perubahan di sini
        // menyeragamkan seluruh tampilan gelap (kartu, modal, tabel, input).
        slate: {
          600: '#3d4864',
          700: '#2b3449',
          800: '#1b2235',
          900: '#121829', // permukaan kartu / sidebar / topbar
          950: '#0b0f1c',
        },
        surface: {
          light: '#f4f6fb',
          dark: '#080b14', // latar halaman (lebih gelap dari kartu)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 8px 24px -6px rgba(15, 23, 42, 0.12)',
        pop: '0 20px 45px -12px rgba(15, 23, 42, 0.28)',
        'glow-pln': '0 10px 26px -10px rgba(27, 117, 187, 0.75)',
        'glow-iris': '0 10px 26px -10px rgba(124, 92, 252, 0.75)',
        'glow-leaf': '0 10px 26px -10px rgba(140, 198, 63, 0.7)',
        'glow-gold': '0 10px 26px -10px rgba(247, 166, 0, 0.7)',
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      backgroundImage: {
        'grad-pln': 'linear-gradient(135deg, #1B75BB 0%, #7c5cfc 100%)',
        'grad-iris': 'linear-gradient(135deg, #7c5cfc 0%, #4f8dfd 100%)',
        'grad-leaf': 'linear-gradient(135deg, #8CC63F 0%, #22c58a 100%)',
        'grad-gold': 'linear-gradient(135deg, #F7A600 0%, #fb7185 100%)',
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
