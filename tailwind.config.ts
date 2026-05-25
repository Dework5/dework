import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#E8273C', dark: '#C41E30' },
        background: '#0A0A0A',
        surface: '#141414',
        'surface-elevated': '#1E1E1E',
        'text-primary': '#F5F5F5',
        'text-secondary': '#A0A0A0',
        'text-muted': '#606060',
        border: '#2A2A2A',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      maxWidth: { content: '1280px' },
    },
  },
  plugins: [],
}

export default config
