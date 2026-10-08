import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base` must match the GitHub Pages sub-path:
// https://furuhashilab.github.io/Hackathon_Oct_YudaiKato/
export default defineConfig({
  base: "/Hackathon_Oct_YudaiKato/",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000,
  },
  worker: {
    format: "es",
  },
});
