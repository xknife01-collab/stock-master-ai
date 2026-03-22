/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#040507',
        'gain-color': '#00ffab',
        'loss-color': '#ff3d68',
        'text-primary': '#ffffff',
        'text-secondary': 'rgba(255, 255, 255, 0.6)',
      },
    },
  },
  plugins: [],
}
