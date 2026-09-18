import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mgreen: { DEFAULT: "#22864D", dark: "#1B6B3E" },
        myellow: "#F7C600",
        mwarn: "#F7A600",
        merror: "#E5322D",
        msurface: "#F5F5F5",
        msurface2: "#F0F0F0",
        mtext: "#333333",
        mmuted: "#767676",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
