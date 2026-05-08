import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primarios
        primary: "#004d64",
        "primary-container": "#006684",
        "primary-fixed": "#bee9ff",
        "primary-fixed-dim": "#87d0f2",
        "inverse-primary": "#87d0f2",
        // Secundarios
        secondary: "#526166",
        "secondary-container": "#d5e5eb",
        "secondary-fixed": "#d5e5eb",
        // Terciarios
        tertiary: "#6b3a00",
        "tertiary-container": "#885116",
        "tertiary-fixed": "#ffdcc0",
        // Superficie
        surface: "#faf9fc",
        background: "#faf9fc",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f4f3f6",
        "surface-container": "#eeedf1",
        "surface-container-high": "#e8e8eb",
        "surface-container-highest": "#e2e2e5",
        // Semánticos
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        outline: "#70787e",
        "outline-variant": "#bfc8cd",
        // Texto
        "on-surface": "#1a1c1e",
        "on-surface-variant": "#3f484d",
        "on-primary": "#ffffff",
        "on-primary-container": "#a2e1ff",
        "on-secondary-container": "#58676c",
        "on-tertiary-container": "#ffcfa6",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      fontFamily: {
        headline: ["var(--font-manrope)", "sans-serif"],
        body: ["var(--font-public-sans)", "sans-serif"],
        label: ["var(--font-public-sans)", "sans-serif"],
      },
      boxShadow: {
        editorial: "0 8px 32px rgba(26, 28, 30, 0.06)",
        fab: "0 8px 32px rgba(0, 77, 100, 0.25)",
      },
    },
  },
  plugins: [],
}

export default config
