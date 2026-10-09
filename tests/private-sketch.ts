import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Private acceptance archives are supplied locally, never published or copied.
const suppliedPath = process.env.SKETCH_FIXTURE;
const localPath = resolve("Test.sketch");
export const testSketchPath = suppliedPath
  ? resolve(suppliedPath)
  : existsSync(localPath)
    ? localPath
    : undefined;

if (suppliedPath && (!testSketchPath || !existsSync(testSketchPath)))
  throw new Error(
    "SKETCH_FIXTURE must point to an existing Test.sketch archive.",
  );

export function readTestSketch(): Buffer {
  if (!testSketchPath)
    throw new Error(
      "Supply Test.sketch with SKETCH_FIXTURE to run acceptance tests.",
    );
  return readFileSync(testSketchPath);
}
