import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["tests/type/**/*.test-d.ts"],
    },
  },
});
