/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#f15922',
        secondary: '#dba747'
      },
      screens: {
        // Suppression des breakpoints mobiles
        'sm': '1024px', // Force desktop-first
        'md': '1280px',
        'lg': '1440px',
        'xl': '1680px',
        '2xl': '1920px'
      }
    }
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true
  }
};