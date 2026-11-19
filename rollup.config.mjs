import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import replace from "@rollup/plugin-replace";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

export default {
  input: "src/index.ts",
  output: { file: "dist/brinstar-cards.js", format: "es", inlineDynamicImports: true },
  plugins: [
    replace({ preventAssignment: true, values: { __VERSION__: JSON.stringify(version) } }),
    nodeResolve(),
    typescript({ tsconfig: "./tsconfig.json", include: ["src/**/*.ts"], noEmitOnError: true }),
    terser({ format: { comments: false } }),
  ],
};
