import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // コンテナ内から見えるように 0.0.0.0 で待つ
    host: true,
    port: 5173,
    watch: {
      // Docker for Mac のバインドマウントは inotify が飛ばないことがある
      usePolling: true,
    },
  },
});
