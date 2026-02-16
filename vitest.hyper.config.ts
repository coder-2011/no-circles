import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/hyper/**/*.test.ts"],
    testTimeout: 240000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
