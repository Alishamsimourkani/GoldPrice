
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        luxury: ['Playfair Display', 'serif'],
      },
      colors: {
        gold: {
          light: '#f1d592',
          DEFAULT: '#d4af37',
          dark: '#b8860b',
        }
      }
    },
  },
  plugins: [],
}
