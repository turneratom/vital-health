import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { shipperIdsPlugin } from "./plugins/vite-plugin-shipper-ids";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    shipperIdsPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    entries: ["index.html", "src/**/*.{ts,tsx,js,jsx}"],

    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@radix-ui/react-select",
      "@radix-ui/react-slot",
      "@radix-ui/react-alert-dialog",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
    ],
  },
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.convex/**', '**/convex/_generated/**'],
    },
    host: "0.0.0.0",
    strictPort: false,
    allowedHosts: [".modal.host", "shipper.now", "localhost", ".localhost"],
  },
});
