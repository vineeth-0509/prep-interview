import type { Config } from "tailwindcss";

/**
 * Design plan (see README for the fuller rationale):
 * - Palette: warm paper background (#FAF9F6), near-ink text (#1B1E24),
 *   a single focused teal accent (#1F6F6B) for primary actions and the
 *   "must-have" priority tag, slate for secondary text, a muted amber
 *   for "nice-to-have" — deliberately not the terracotta/near-black
 *   AI-generated defaults.
 * - Type: Source Serif 4 for headings (a study-guide/notebook feel
 *   appropriate to interview prep), Inter for UI and body text.
 * - Layout: left-aligned, border-based structure rather than
 *   shadow-cards; a persistent section nav in the builder rather than
 *   a single long scroll.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F6",
        ink: "#1B1E24",
        slate: "#5B6472",
        teal: {
          DEFAULT: "#1F6F6B",
          dark: "#164F4C",
          light: "#E4F1F0",
        },
        amber: {
          DEFAULT: "#B5792B",
          light: "#F6ECDD",
        },
        line: "#E4E1D8",
      },
      fontFamily: {
        display: ["var(--font-source-serif)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
