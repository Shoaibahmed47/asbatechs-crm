import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        /** Teal brand scale — maps Tailwind brand-* used across CRM pages */
        brand: {
          DEFAULT: "var(--brand-teal-light)",
          50: "var(--teal-60)",
          100: "var(--teal-80)",
          200: "var(--teal-100)",
          300: "var(--teal-150)",
          400: "var(--brand-teal-lighter)",
          500: "var(--teal-500)",
          600: "var(--brand-teal-light)",
          700: "var(--brand-teal)",
          800: "var(--brand-teal)",
          900: "var(--brand-teal)",
          950: "color-mix(in srgb, var(--brand-teal) 88%, black)",
          teal: "var(--brand-teal)",
          "teal-light": "var(--brand-teal-light)",
          fg: "var(--brand-fg)",
          orange: "var(--brand-orange)",
          "orange-light": "var(--brand-orange-light)",
          gold: "var(--brand-gold)"
        },
        primary: {
          DEFAULT: "var(--brand-teal-light)",
          foreground: "#ffffff"
        }
      },
      boxShadow: {
        apple: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)",
        "apple-lg":
          "0 10px 15px -3px rgba(15,76,69,0.1), 0 4px 6px -2px rgba(15,76,69,0.05)",
        brand: "0 10px 25px rgba(15, 76, 69, 0.22)",
        "brand-soft": "0 12px 36px rgba(15, 76, 69, 0.12)"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display-stack)"],
        mono: ["var(--font-mono-stack)"]
      }
    }
  },
  plugins: []
};

export default config;
