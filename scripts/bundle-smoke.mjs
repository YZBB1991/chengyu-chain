import { build } from "esbuild";
await build({
  entryPoints: ["scripts/smoke.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "/tmp/smoke.bundle.mjs",
  logLevel: "info",
});
console.log("bundled");
