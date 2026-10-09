import type { Config } from "tailwindcss";

// Paleta Escalas e Extras: verde-folha (ação), tinta (texto), neutros frios esverdeados.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // "teal" e "stone" são reaproveitados pelas telas existentes
        teal: {
          50: "#EEF6F1", 100: "#D8EBDF", 200: "#B3D6C2", 300: "#85BA9D", 400: "#4F977A",
          500: "#2F7A5E", 600: "#1F6A4F", 700: "#17553F", 800: "#10402F", 900: "#0B2C21",
        },
        stone: {
          50: "#F5F7F4", 100: "#ECEFEA", 200: "#DDE2DA", 300: "#C6CDC3", 400: "#9BA59A",
          500: "#6F7B70", 600: "#556157", 700: "#3B463E", 800: "#26302A", 900: "#15211C",
        },
        brasa: { 500: "#D9482B", 600: "#BF3A1F", 100: "#FBE4DD" },
        ink: "#15211C",
      },
      borderRadius: { xl: "14px", "2xl": "18px" },
      boxShadow: { card: "0 1px 0 rgba(21,33,28,.04), 0 1px 3px rgba(21,33,28,.06)" },
    },
  },
  plugins: [],
};
export default config;
