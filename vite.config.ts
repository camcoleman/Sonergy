import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves from /Sonergy/ when repo name is Sonergy
const base = process.env.GITHUB_ACTIONS ? "/Sonergy/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});

