import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "main.ts",
      formats: ["es"],
      fileName: "main",
    },
    outDir: "dist",
  },
});
