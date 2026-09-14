import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const apiTarget = "http://127.0.0.1:5000";

  return {
    // Use relative paths for Electron file:// protocol
    base: "./",
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      // Dev-only proxy to avoid CORS: frontend calls /api/*, Vite forwards to your backend.
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        "/adminlogin": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        "/userlogin": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Ensure assets use relative paths
      assetsDir: "assets",
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});

