import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        meli: {
          yellow: '#FFE600',
          blue: '#3483FA',
          dark: '#1A1A2E',
        },
      },
    },
  },
  plugins: [],
}

export default config
