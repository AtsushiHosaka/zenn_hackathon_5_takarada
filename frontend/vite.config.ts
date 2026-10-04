import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_");
  const target = process.env.API_UPSTREAM_ORIGIN || env.API_UPSTREAM_ORIGIN || "https://zenn-hackathon-api-262220651661.asia-northeast1.run.app";
  const proxy = { "/api": { target, changeOrigin: true, secure: true } };
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      proxy,
      watch: { usePolling: true },
    },
    preview: { proxy },
  };
});
