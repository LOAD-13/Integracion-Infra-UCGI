/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 3000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: false,
    // Excluye specs Playwright: viven en tests/e2e y corren con `npm run test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
    coverage: {
      // HU-06.3 (IUDCYGI-39): cobertura TS con provider v8 nativo y formatos
      // text (resumen consola), html (browseable), lcov (sonar-scanner), json-summary
      // (badges + scripts). Thresholds bajos en baseline; HU-06.5 documenta
      // como ISO 25010 Fiabilidad/Madurez.
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/**/*.d.ts",
        "src/tests/**",
        "src/**/__tests__/**",
        "src/setupTests.ts",
      ],
      thresholds: {
        lines: 12,
        functions: 25,
        statements: 12,
        branches: 50,
      },
    },
  },
});
