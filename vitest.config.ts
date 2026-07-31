import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    // Pin TZ so Date math (`getDate`, `getDay`, `setDate`, `toISOString`)
    // produces identical bucket boundaries across developer machines and
    // CI runners. The bucket helpers under test rely on local-day math,
    // which is otherwise TZ-fragile.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
