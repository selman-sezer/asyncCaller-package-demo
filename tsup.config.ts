import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["cjs", "esm", "iife"],
  outDir: "lib",
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "esnext",
  minify: true,
});
