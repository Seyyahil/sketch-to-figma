import { build, context } from "esbuild";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
const watch = process.argv.includes("--watch");
await mkdir("dist", { recursive: true });
if (!watch) await rm("dist/plugin.js.map", { force: true });
const common = {
  bundle: true,
  target: "es2020",
  logLevel: "info",
  sourcemap: watch,
};
const worker = await build({
  ...common,
  entryPoints: ["src/sketch/worker.ts"],
  write: false,
  sourcemap: false,
  format: "iife",
});
const ui = await build({
  ...common,
  entryPoints: ["src/ui/main.ts"],
  write: false,
  sourcemap: false,
  format: "iife",
  define: {
    __WORKER__: JSON.stringify(
      worker.outputFiles.find((f) => f.path.endsWith(".js"))?.text ??
        worker.outputFiles[0].text,
    ),
  },
});
const theme = await readFile("src/ui/theme.css", "utf8");
const template = (await readFile("src/ui/index.html", "utf8")).replace(
  "/* THEME_CSS */",
  () => theme,
);
await writeFile(
  "dist/ui.html",
  template.replace("/* UI_BUNDLE */", () =>
    (
      ui.outputFiles.find((f) => f.path.endsWith(".js"))?.text ??
      ui.outputFiles[0].text
    ).replaceAll("</script", "<\\/script"),
  ),
);
const plugin = {
  ...common,
  entryPoints: ["src/plugin.ts"],
  outfile: "dist/plugin.js",
  format: "iife",
};
if (watch) {
  const ctx = await context(plugin);
  await ctx.watch();
  console.log("Plugin watch active; rerun build after UI edits.");
} else await build(plugin);
