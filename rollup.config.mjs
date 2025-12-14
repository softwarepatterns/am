import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";

import { builtinModules, createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const externalDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default [
  // JS builds (ESM + CJS)
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs", sourcemap: true, exports: "named" },
      { file: pkg.module, format: "esm", sourcemap: true },
    ],
    plugins: [
      nodeResolve({ extensions: [".mjs", ".js", ".json", ".ts"] }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist/types",
        sourceMap: true,
      }),
      terser(),
    ],
    external: externalDeps,
  },

  // Types build (single bundled .d.ts)
  {
    input: "dist/types/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
    external: externalDeps,
  },
];
