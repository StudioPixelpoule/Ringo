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
  // Purge options
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './index.html',
      './src/**/*.{js,ts,jsx,tsx}',
    ],
    options: {
      safelist: [
        // Classes that might be dynamically generated
        /^prose-/,
        /^message-/,
        /^streaming-/,
        /^typing-/,
        /^neumorphic-/,
        // Animation classes
        'animate-spin',
        'animate-pulse',
        'animate-bounce',
      ],
      blocklist: [
        // Classes we never want
        'debug',
        'outline',
      ],
      keyframes: true,
      fontFace: true,
    },
  },
};