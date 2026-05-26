/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cool, calm palette. ink = bg, surface = cards, accent = brand.
        ink:     { DEFAULT: "#0b0f17", soft: "#11161f", muted: "#1a2030" },
        surface: { DEFAULT: "#141a25", hover: "#1b2230" },
        line:    "#222a39",
        accent:  { DEFAULT: "#5eead4", soft: "#0f3c36" }, // teal
        good:    "#34d399",
        warn:    "#fbbf24",
        bad:     "#f87171",
        dim:     "#7a8499",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(94,234,212,0.18), 0 8px 30px -10px rgba(94,234,212,0.25)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
