import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Lausanne time is the domain here; pin it so schedule tests don't depend
    // on whatever timezone the machine running them happens to be in.
    env: { TZ: "Europe/Zurich" },
  },
});
