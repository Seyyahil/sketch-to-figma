import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PNG } from "pngjs";
import { build } from "esbuild";
import { resolve, dirname } from "node:path";
const [sourcePath, targetPath, outputPrefix] = process.argv.slice(2);
if (!sourcePath || !targetPath || !outputPrefix)
  throw new Error(
    "Usage: node scripts/compare-renders.mjs source.png figma.png output-prefix",
  );
const [source, target] = await Promise.all(
  [sourcePath, targetPath].map(async (p) => PNG.sync.read(await readFile(p))),
);
const width = Math.max(source.width, target.width),
  height = Math.max(source.height, target.height);
const pad = (image) => {
  const bytes = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < image.height; y++)
    bytes.set(
      image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4),
      y * width * 4,
    );
  return bytes;
};
const result = await build({
  entryPoints: ["src/core/pixels.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { comparePixels } = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const { heatmap, ...diff } = comparePixels(
  pad(source),
  pad(target),
  width,
  height,
  16,
);
const metrics = {
  source: {
    path: resolve(sourcePath),
    width: source.width,
    height: source.height,
  },
  target: {
    path: resolve(targetPath),
    width: target.width,
    height: target.height,
  },
  alignment: "Top-left, transparent padding; no resampling",
  dimensionsEqual:
    source.width === target.width && source.height === target.height,
  ...diff,
  passed:
    source.width === target.width &&
    source.height === target.height &&
    diff.changedPixels === 0,
  note: "One frame sample. Pixel differences may include font rendering and color-profile differences; this does not certify the document.",
};
await mkdir(dirname(resolve(outputPrefix)), { recursive: true });
const png = new PNG({ width, height });
png.data = Buffer.from(heatmap);
await writeFile(outputPrefix + ".heatmap.png", PNG.sync.write(png));
await writeFile(
  outputPrefix + ".metrics.json",
  JSON.stringify(metrics, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    dimensionsEqual: metrics.dimensionsEqual,
    changedRatio: metrics.changedRatio,
    meanAbsoluteError: metrics.meanAbsoluteError,
    passed: metrics.passed,
  }),
);

process.exitCode = metrics.passed ? 0 : 1;
