import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure frontend logic.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Tests sit beside the code they test, named *.spec.ts.
  test: { include: ["src/**/*.spec.ts"] },
});
