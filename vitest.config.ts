import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["test/unit/**/*.test.ts", "test/unit/**/*.test.tsx"],
    globals: true,
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "lib/**/*.ts",
        "hooks/**/*.ts",
        "services/**/*.ts",
        "store/**/*.ts",
      ],
      exclude: [
        "lib/wagmi.test.ts",
        "**/*.d.ts",
        "**/index.ts",
      ],
      thresholds: {
        lines: 30,      // Realistic for a DeFi app (many hooks need real wagmi/RPC)
        functions: 25,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
