import { readTestSketch, testSketchPath } from "./private-sketch";
import { unzipSync, strFromU8 } from "fflate";
import { expect, it } from "vitest";
import { bindingFixture } from "./binding-fixture";
import { createHost } from "./mock-figma";
import { startImport } from "../src/figma/importer";
import { readIndex } from "../src/figma/storage";
import { DEFAULT_OPTIONS, type SketchFile } from "../src/core/types";

const white = { r: 1, g: 1, b: 1, a: 1 };
const options = {
  ...DEFAULT_OPTIONS,
  fallbackFont: { family: "Inter", style: "Regular" },
};
const run = (h: ReturnType<typeof createHost>, file: SketchFile) =>
  startImport(h.api, file, options).result;
function expectSourceColors(
  h: ReturnType<typeof createHost>,
  file: SketchFile,
) {
  const index = readIndex(h.api, file.documentId);
  const collection = h.collections.get(index.resources["color-collection"]);
  for (const sw of file.document.sharedSwatches.objects) {
    const v = h.variables.get(index.resources[`color:${sw.do_objectID}`]);
    expect(v, sw.name).toBeDefined();
    const c = sw.value;
    expect(v.valuesByMode[collection.defaultModeId], sw.name).toEqual({
      r: c.red,
      g: c.green,
      b: c.blue,
      a: c.alpha,
    });
  }
}
it("assigns every source color on fresh import", async () => {
  const h = createHost(),
    file = bindingFixture();
  await run(h, file);
  expectSourceColors(h, file);
});
it("repairs white imported variables in place under the normal import options", async () => {
  const h = createHost(),
    file = bindingFixture();
  await run(h, file);
  const ids = [...h.variables.keys()];
  for (const v of h.variables.values())
    for (const mode of Object.keys(v.valuesByMode))
      v.setValueForMode(mode, white);
  const report = await run(h, file);
  expectSourceColors(h, file);
  expect([...h.variables.keys()]).toEqual(ids);
  expect(report.findings.filter((f) => f.code === "RESOURCE_CONFLICT")).toEqual(
    [],
  );
});
it("initializes missing variables despite stale saved resource records", async () => {
  const h = createHost(),
    file = bindingFixture();
  await run(h, file);
  for (const v of [...h.variables.values()]) v.remove();
  await run(h, file);
  expectSourceColors(h, file);
  const ids = [...h.variables.keys()];
  await run(h, file);
  expect([...h.variables.keys()]).toEqual(ids);
});
it("initializes a recreated collection after its variables were removed", async () => {
  const h = createHost(),
    file = bindingFixture();
  await run(h, file);
  for (const v of [...h.variables.values()]) v.remove();
  for (const c of [...h.collections.values()]) c.remove();
  await run(h, file);
  expectSourceColors(h, file);
});
it("recovers the prior bug's unindexed white replacement without leaving text on it", async () => {
  const h = createHost(),
    file = bindingFixture();
  await run(h, file);
  const index = readIndex(h.api, file.documentId);
  const collection = h.collections.get(index.resources["color-collection"]);
  const prior = h.variables.get(index.resources["color:C"]);
  const scopes = prior.scopes;
  prior.remove();
  const replacement = h.api.variables.createVariable(
    "Brand / Blue",
    collection,
    "COLOR",
  );
  replacement.scopes = scopes;
  replacement.setValueForMode(collection.defaultModeId, white);
  const text = h.nodes.get(index.nodes.T.nodeId);
  text.setRangeFills(0, text.characters.length, [
    {
      type: "SOLID",
      color: { r: 1, g: 1, b: 1 },
      boundVariables: { color: { type: "VARIABLE_ALIAS", id: replacement.id } },
    },
  ]);
  await run(h, file);
  expectSourceColors(h, file);
  expect(readIndex(h.api, file.documentId).resources["color:C"]).toBe(
    replacement.id,
  );
  expect(h.variables.size).toBe(2);
  expect(
    text.getRangeFills(0, text.characters.length)[0].boundVariables.color.id,
  ).toBe(replacement.id);
});
it("leaves explicit variable mappings and unrelated collections alone", async () => {
  const h = createHost(),
    file = bindingFixture();
  const collection = h.api.variables.createVariableCollection("User colors");
  const mapped = h.api.variables.createVariable(
    "Brand / Blue",
    collection,
    "COLOR",
  );
  mapped.setValueForMode(collection.defaultModeId, white);
  await startImport(h.api, file, { ...options, variableMap: { C: mapped.id } })
    .result;
  expect(mapped.valuesByMode[collection.defaultModeId]).toEqual(white);
  expect(readIndex(h.api, file.documentId).resources["color:C"]).toBe(
    mapped.id,
  );
});
it("reports a color assignment that does not read back as the Sketch value", async () => {
  const h = createHost(),
    file = bindingFixture();
  const create = h.api.variables.createVariable;
  h.api.variables.createVariable = ((...args: any[]) => {
    const v = (create as any)(...args);
    v.setValueForMode = (mode: string) => {
      v.valuesByMode[mode] = white;
    };
    return v;
  }) as any;
  const report = await run(h, file);
  expect(
    report.findings.filter(
      (f) => f.code === "VARIABLE_FAILURE" && f.severity === "error",
    ),
  ).toHaveLength(2);
});
it.skipIf(!testSketchPath)(
  "restores all 29 real Test.sketch swatches after the white replacement failure",
  async () => {
    const zip = unzipSync(new Uint8Array(readTestSketch()), {
      filter: (f) => f.name === "document.json",
    });
    const document = JSON.parse(strFromU8(zip["document.json"]));
    const file = bindingFixture();
    file.pages = [];
    file.document = {
      colorSpace: document.colorSpace,
      sharedSwatches: document.sharedSwatches,
    };
    const h = createHost();
    await run(h, file);
    expectSourceColors(h, file);
    const index = readIndex(h.api, file.documentId);
    const collection = h.collections.get(index.resources["color-collection"]);
    for (const old of [...h.variables.values()]) {
      old.remove();
      const replacement = h.api.variables.createVariable(
        old.name,
        collection,
        "COLOR",
      );
      replacement.scopes = old.scopes;
      replacement.setValueForMode(collection.defaultModeId, white);
    }
    const replacements = [...h.variables.keys()];
    await run(h, file);
    expectSourceColors(h, file);
    expect([...h.variables.keys()]).toEqual(replacements);
    expect(h.variables.size).toBe(29);
  },
);
