/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#E8F5F0', 100: '#CDEBE0', 200: '#9FE1CB', 300: '#5DCAA5', 400: '#2FB488',
          500: '#1D9E75', 600: '#0F6E56', 700: '#0B5A46', 800: '#084536', 900: '#053026',
        },
        ink: { 950: '#0D110F', 900: '#141917', 850: '#1A201D', 800: '#212824', 700: '#2C3430' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,20,0.04), 0 1px 3px rgba(16,24,20,0.06)',
        lift: '0 4px 12px rgba(16,24,20,0.08), 0 2px 4px rgba(16,24,20,0.04)',
        pop: '0 16px 40px rgba(16,24,20,0.18)',
      },
      keyframes: {
        'page-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'pop-in': { from: { opacity: 0, transform: 'scale(.97) translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'toast-in': { from: { opacity: 0, transform: 'translateY(8px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        gradient: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        flash: { '0%': { backgroundColor: 'rgba(29,158,117,0.25)' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: {
        'page-in': 'page-in 180ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 180ms ease-out',
        'toast-in': 'toast-in 200ms ease-out',
        shimmer: 'shimmer 1.4s infinite',
        gradient: 'gradient 14s ease infinite',
        flash: 'flash 1.6s ease-out',
      },
    },
  },
  plugins: [],
};
