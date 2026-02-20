/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          parchment: '#f4ede1',
          ink: '#2a2118',
          red: '#b72f2a',
          redDeep: '#8f1f1a',
          gold: '#c7a15a',
          stone: '#6e5a45',
        },
      },
      boxShadow: {
        card: '0 14px 30px rgba(46, 33, 22, 0.16)',
      },
    },
  },
  plugins: [],
};
