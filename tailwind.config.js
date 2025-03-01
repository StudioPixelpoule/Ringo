/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ringo: {
          orange: '#f15922',
          green: '#2f5c54',
          gold: '#dba747',
          beige: '#cfd3bd',
          peach: '#FFCDB6',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      transitionProperty: {
        'size': 'width, height, transform',
      },
    },
  },
  plugins: [],
};