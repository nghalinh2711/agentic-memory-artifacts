import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/helpers/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/**/*.test.skip.{ts,tsx}", "node_modules"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./tests/artifacts/coverage",
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
      },
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/app/layout.tsx",
        "src/components/ThemeRegistry.tsx",
        "src/lib/types.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
