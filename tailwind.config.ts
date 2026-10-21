import type { Config } from "tailwindcss";

/**
 * wishtrip design system.
 * Palette lifted from wishtrip.co's own CSS tokens: teal (primary), clay
 * (accent), saffron (value/highlight), sand (surfaces) and ink (text).
 * Semantic tokens are CSS variables (globals.css); the static scales below
 * are for one-off accents.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        brand: {
          50: "#e9f3f0",
          100: "#cfe6e0",
          200: "#a6d3c8",
          300: "#57b8a3",
          400: "#2e9b87",
          500: "#147a6b",
          600: "#0e5e52", // wishtrip --teal-700 (primary)
          700: "#0b4d43",
          800: "#08423a", // --teal-900
          900: "#05302a",
        },
        clay: {
          50: "#fdf1ea",
          100: "#fbe7dc",
          300: "#f2916e",
          500: "#e8663d", // wishtrip accent
          600: "#c6522e",
        },
        saffron: {
          100: "#f7ebd3",
          400: "#efa23f",
          700: "#6b4e16",
        },
        sand: {
          50: "#fbf8f2",
          100: "#f4eee4",
          200: "#e7dfd1",
          300: "#d9cfbd",
        },
        ink: {
          900: "#16211e",
          600: "#57635e",
          400: "#8b958f",
        },
        pine: {
          950: "#0d1513",
          900: "#131d1a",
          850: "#1a2622",
          800: "#24322d",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-bottom": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "zoom-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "pulse-soft": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.45" } },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "slide-in-right": "slide-in-right 0.22s ease-out",
        "slide-in-left": "slide-in-left 0.22s ease-out",
        "slide-in-bottom": "slide-in-bottom 0.24s ease-out",
        "overlay-in": "overlay-in 0.18s ease-out",
        "zoom-in": "zoom-in 0.16s ease-out",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
