import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    testTimeout: 60_000,
    // Etikett-CSS wird per ?raw ins PDF eingebettet und muss auch im Test echt sein
    css: { include: [/label\.css/] },
  },
});
