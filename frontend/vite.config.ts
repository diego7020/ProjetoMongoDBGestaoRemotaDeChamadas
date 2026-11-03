import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A interface chama a API em "/api" (mesma origem) e o Vite repassa para a API local.
// Assim a API continua escutando só em 127.0.0.1 e um único túnel expõe tudo.
const proxy = {
  "/api": {
    target: "http://127.0.0.1:3000",
    rewrite: (caminho: string) => caminho.replace(/^\/api/, ""),
    xfwd: true, // repassa o IP real do visitante (X-Forwarded-For) para rate limit e auditoria
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost", // só na máquina local
    port: 5173,
    strictPort: true,
    proxy,
  },
  // "vite preview" serve a versão compilada (dist/) — é o que vai para o túnel
  preview: {
    host: "localhost",
    port: 4173,
    strictPort: true,
    proxy,
    allowedHosts: [".trycloudflare.com"], // só aceita o domínio do túnel (além de localhost)
  },
});
