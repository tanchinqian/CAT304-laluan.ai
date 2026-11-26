import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: resolve(__dirname, "../.."),
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
});
