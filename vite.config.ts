import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site: https://<user>.github.io/igc-explorer/
export default defineConfig({
  plugins: [react()],
  base: "/igc-explorer/",
});
