/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vault: {
          50: "#f6f8fa",
          100: "#eaeef2",
          200: "#d0d7de",
          300: "#afb8c1",
          400: "#8c959f",
          500: "#6e7781",
          600: "#57606a",
          700: "#424a53",
          800: "#32383f",
          900: "#24292f",
          950: "#090d16",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "\"SF Pro Display\"",
          "\"SF Pro Text\"",
          "\"Segoe UI\"",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "\"SF Mono\"",
          "ui-monospace",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
}
