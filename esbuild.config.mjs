import builtins from "builtin-modules";
import esbuild from "esbuild";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import process from "process";

const production = process.argv[2] === "production";

const polyfillPlugin = polyfillNode({
  globals: false,
  polyfills: { stream: true }
});

const config = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2020",
  outfile: "main.js",
  sourcemap: !production,
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"'
  },
  plugins: [
    inlineWorkerPlugin({
      plugins: [polyfillPlugin]
    })
  ]
};


esbuild.build(config)
  .then(() => console.log("✅ Build completato!"))
  .catch(() => process.exit(1));