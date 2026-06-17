import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/extension.ts",
  external: ["vscode"],
  platform: "node",
  output: {
    file: "dist/extension.cjs",
    format: "cjs",
    sourcemap: true,
    codeSplitting: false,
    minify: true,
  },
});
