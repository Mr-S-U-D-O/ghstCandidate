/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Overrides the default sans to Lato for all body text
        sans: ['Lato', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Custom heading family — use `font-heading` class anywhere
        heading: ['Comfortaa', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Status colors (use ONLY for status indicators)
        status: {
          success: '#16A34A',
          warning: '#D97706',
          error:   '#DC2626',
          info:    '#2563EB',
        },
      },
    },
  },
  plugins: [],
}
