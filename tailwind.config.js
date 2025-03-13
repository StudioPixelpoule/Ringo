/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#f15922',
        secondary: '#dba747',
        tertiary: '#106f69',
        neutral: '#cfd3bd',
      },
    },
  },
  plugins: [],
  safelist: [
    // Classes that might be dynamically generated
    {
      pattern: /^prose-/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /^message-/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /^streaming-/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /^typing-/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /^neumorphic-/,
      variants: ['hover', 'focus', 'active'],
    },
    // Animation classes
    'animate-spin',
    'animate-pulse',
    'animate-bounce',
  ],
};