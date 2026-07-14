import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--fg-1)",
        muted: "var(--fg-2)",
        border: "var(--hairline)",
      },
      borderRadius: {
        lg: "var(--r-5)",
        md: "var(--r-3)",
        sm: "var(--r-2)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
