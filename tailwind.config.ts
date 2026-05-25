import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dw-black':   '#080808',
        'dw-surface': '#0F0F0F',
        'dw-card':    '#141414',
        'dw-border':  '#1E1E1E',
        'dw-hover':   '#2A2A2A',
        'dw-muted':   '#555555',
        'dw-sub':     '#888888',
        'dw-text':    '#EBEBEB',
        'dw-white':   '#FFFFFF',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body:    ['var(--font-body)'],
      },
    },
  },
  plugins: [],
}

export default config
