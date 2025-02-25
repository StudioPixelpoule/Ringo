/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ringo: {
          orange: '#E86A45',
          green: '#3C584E',
          gold: '#C9A959',
          beige: '#D9DDD1',
          peach: '#FFCDB6',
        },
      },
    },
  },
  plugins: [],
};