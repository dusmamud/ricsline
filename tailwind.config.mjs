/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Graphite dark-theme scale
        graphite: {
          50: '#F4F6F9',
          100: '#E6EAF0',
          200: '#CBD3DF',
          300: '#A8B3C7',
          400: '#7E8AA1',
          500: '#5B667D',
          600: '#4A5468',
          700: '#343B48',
          800: '#262B34',
          900: '#1C1F26',
          950: '#14161B',
        },
        // Sky-blue brand
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },
      },
      fontFamily: {
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        sans: [
          'Inter',
          'system-ui',
          // Indic
          "'Noto Sans Devanagari'",
          "'Noto Sans Bengali'",
          // CJK
          "'Noto Sans SC'",
          "'Noto Sans JP'",
          "'Noto Sans KR'",
          // Arabic / Thai / others
          "'Noto Sans Arabic'",
          "'Noto Sans Thai'",
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'wave-bar': {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 7s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite',
      },
    },
  },
  plugins: [],
};
