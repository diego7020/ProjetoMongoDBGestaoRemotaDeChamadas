import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost", // só na máquina local
    port: 5173, // precisa bater com CORS_ORIGIN do backend
    strictPort: true,
  },
});
