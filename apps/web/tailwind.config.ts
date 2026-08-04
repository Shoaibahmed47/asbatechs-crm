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
        brand: {
          teal: "var(--brand-teal)",
          "teal-light": "var(--brand-teal-light)",
          orange: "var(--brand-orange)",
          gold: "var(--brand-gold)"
        }
      },
      boxShadow: {
        apple: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)",
        "apple-lg": "0 10px 15px -3px rgba(15,76,69,0.1), 0 4px 6px -2px rgba(15,76,69,0.05)"
      }
    }
  },
  plugins: []
};

export default config;

