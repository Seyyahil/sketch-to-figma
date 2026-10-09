import { it, expect } from "vitest";
import { bindingFixture } from "./binding-fixture";
import { createHost } from "./mock-figma";
import { startImport } from "../src/figma/importer";
import { readIndex, writeData } from "../src/figma/storage";
import { readReport } from "../src/figma/report-storage";
import {
  resourceSelection,
  importFontNames,
} from "../src/core/resource-selection";
import {
  DEFAULT_OPTIONS,
  type ImportOptions,
  type TokenFile,
} from "../src/core/types";

const resourceTypes = {
  colors: false,
  layerStyles: false,
  textStyles: false,
  components: false,
  tokens: false,
};
const options: ImportOptions = { ...DEFAULT_OPTIONS, resourceTypes };
function source() {
  const file = bindingFixture();
  file.document.sharedSwatches.objects.push({
    _class: "swatch",
    do_objectID: "UNUSED-COLOR",
    name: "Unused / exact name",
    value: { red: 0.7, green: 0.1, blue: 0.2, alpha: 1 },
  });
  const extra = structuredClone(file.document.layerTextStyles.objects[0]);
  extra.do_objectID = "UNUSED-TEXT";
  extra.name = "Unused / Text";
  extra.value.textStyle.encodedAttributes.MSAttributedStringColorAttribute.swatchID =
    "UNUSED-COLOR";
  extra.value.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.name =
    "UnavailableUnusedFont-Regular";
  file.document.layerTextStyles.objects.push(extra);
  file.document.layerStyles.objects.push({
    _class: "sharedStyle",
    do_objectID: "UNUSED-LAYER",
    name: "Unused layer",
    value: {
      fills: [
        {
          fillType: 0,
          color: {
            swatchID: "UNUSED-COLOR",
            red: 0.7,
            green: 0.1,
            blue: 0.2,
            alpha: 1,
          },
        },
      ],
    },
  });
  return file;
}
it("excludes only unused definitions while retaining nested Symbols, styles, colors and exact names", async () => {
  const file = source(),
    h = createHost(),
    plan = resourceSelection(file, options);
  expect([...plan.symbols].sort()).toEqual(["OUT", "S"]);
  expect([...plan.styles].sort()).toEqual(["LS", "TS"]);
  expect([...plan.colors].sort()).toEqual(["C", "C2"]);
  expect(importFontNames(file, options)).toEqual(["Inter-Regular"]);
  const report = await startImport(h.api, file, options).result;
  expect(report.state).toBe("complete");
  const index = readIndex(h.api, file.documentId);
  expect(index.nodes.MASTER2).toBeUndefined();
  expect(
    Object.keys(index.resources).filter((key) => key.includes("UNUSED")),
  ).toEqual([]);
  for (const id of ["T", "T2"].filter((id) => index.nodes[id])) {
    const text = h.nodes.get(index.nodes[id].nodeId);
    expect(text.getRangeTextStyleId(0, text.characters.length)).toBe(
      index.resources["text:TS"],
    );
  }
  const rect = h.nodes.get(index.nodes.R.nodeId);
  expect(rect.fillStyleId).toBe("");
  expect(rect.strokeStyleId).toBe("");
  expect(rect.effects[0].boundVariables.color.id).toBe(
    index.resources["color:C2"],
  );
  for (const key of ["effect:LS"])
    expect(h.styles.get(index.resources[key]).name).toBe("Surface / Gradient");
  expect(h.variables.get(index.resources["color:C"]).name).toBe("Brand / Blue");
  expect(h.nodes.get(index.nodes.I.nodeId).main.id).toBe(
    index.nodes.MASTER.nodeId,
  );
  expect(h.nodes.get(index.nodes.NI.nodeId).children[0].main.id).toBe(
    index.nodes.MASTER.nodeId,
  );
  const before = structuredClone(index);
  const again = await startImport(h.api, file, options).result;
  expect(again.created).toBe(0);
  expect(readIndex(h.api, file.documentId).resources).toEqual(before.resources);
  expect(readReport(h.api.root, file.documentId)).toEqual(
    JSON.parse(JSON.stringify(again)),
  );
  expect(
    report.layers.find((l) => l.sourceId === "UNUSED-TEXT")?.selected,
  ).toBe(false);
});
it("includes resource and Symbol swap override dependencies with all resource switches off", () => {
  const file = source();
  file.pages[0].layers
    .find((n: any) => n.do_objectID === "I")
    .overrideValues.push({ overrideName: "T_textStyle", value: "UNUSED-TEXT" });
  file.pages[0].layers
    .find((n: any) => n.do_objectID === "NI")
    .overrideValues.push({ overrideName: "INNER_symbolID", value: "S2" });
  const plan = resourceSelection(file, options);
  expect(plan.styles.has("UNUSED-TEXT")).toBe(true);
  expect(plan.colors.has("UNUSED-COLOR")).toBe(true);
  expect(plan.symbols.has("S2")).toBe(true);
  expect(plan.scope.has("MASTER2")).toBe(true);
  expect(importFontNames(file, options)).toContain(
    "UnavailableUnusedFont-Regular",
  );
});
it("imports only required supplied tokens and their mode-specific aliases, retaining component layout bindings on reimport", async () => {
  const file = source(),
    h = createHost();
  const master = file.pages[0].layers.find(
    (n: any) => n.do_objectID === "MASTER",
  );
  master.bridge = {
    stackLayout: {
      direction: "Row",
      gap: 8,
      padding: { top: 4, right: 6, bottom: 4, left: 6 },
      justifyContent: "Start",
      alignItems: "Center",
    },
  };
  const tokens: TokenFile = {
    collection: "Exact source tokens",
    modes: ["Default", "Compact"],
    tokens: [
      {
        name: "Space / base",
        type: "FLOAT",
        values: { Default: 6, Compact: 4 },
      },
      {
        name: "Space / compact",
        type: "FLOAT",
        values: { Default: 3, Compact: 2 },
      },
      {
        name: "Space / padding",
        type: "FLOAT",
        values: { Default: "{Space / base}", Compact: "{Space / compact}" },
      },
      { name: "Unused", type: "FLOAT", values: { Default: 100, Compact: 200 } },
    ],
    bindings: [
      { sourceId: "MASTER", field: "paddingLeft", token: "Space / padding" },
      { sourceId: "MASTER", field: "paddingRight", token: "Space / padding" },
      { sourceId: "R", field: "strokeWeight", token: "Space / base" },
      { sourceId: "R", field: "topLeftRadius", token: "Space / compact" },
    ],
  };
  const config = { ...options, tokens };
  const report = await startImport(h.api, file, config).result;
  expect(report.state).toBe("complete");
  expect(
    report.validations
      .filter((v) => v.kind === "token-binding")
      .map((v) => v.passed),
  ).toEqual([true, true, true, true]);
  const index = readIndex(h.api, file.documentId),
    key = "tokens:Exact source tokens:";
  expect(index.resources[key + "Unused"]).toBeUndefined();
  const variable = h.variables.get(index.resources[key + "Space / padding"]);
  expect(
    new Set(Object.values(variable.valuesByMode).map((v: any) => v.id)),
  ).toEqual(
    new Set([
      index.resources[key + "Space / base"],
      index.resources[key + "Space / compact"],
    ]),
  );
  const component = h.nodes.get(index.nodes.MASTER.nodeId);
  expect(component.layoutMode).toBe("HORIZONTAL");
  expect(component.boundVariables.paddingLeft.id).toBe(variable.id);
  expect(component.boundVariables.paddingRight.id).toBe(variable.id);
  expect(component.paddingTop).toBe(4);
  expect(h.nodes.get(index.nodes.I.nodeId).main.id).toBe(component.id);
  const before = structuredClone(index.resources);
  await startImport(h.api, file, config).result;
  expect(readIndex(h.api, file.documentId).resources).toEqual(before);
  expect(component.boundVariables.paddingLeft.id).toBe(variable.id);
});
it("keeps explicitly selected Symbol definitions and ignores historic detached-style metadata", () => {
  const file = source();
  file.pages[0].layers.find((n: any) => n.do_objectID === "I").userInfo = {
    old: { sharedStyleID: "UNUSED-TEXT", swatchID: "UNUSED-COLOR" },
  };
  const plan = resourceSelection(file, {
    ...options,
    selectedIds: ["MASTER2"],
  });
  expect(plan.symbols.has("S2")).toBe(true);
  expect(plan.styles.has("UNUSED-TEXT")).toBe(false);
  expect(plan.colors.has("UNUSED-COLOR")).toBe(false);
});
it("detects corrupted stored audits instead of returning incomplete evidence", async () => {
  const h = createHost();
  expect(readReport(h.api.root, "missing")).toBeNull();
  writeData(h.api.root, "audit:broken", {
    encoding: "zlib-hex-v1",
    data: "deadbeef",
  });
  expect(() => readReport(h.api.root, "broken")).toThrow(
    "Corrupted conversion audit",
  );
});

it("reports audit storage failures even when the document conversion has committed", async () => {
  const h = createHost(),
    original = h.api.root.setPluginData.bind(h.api.root);
  h.api.root.setPluginData = (key: string, value: string) => {
    if (key.startsWith("sketch2figma:audit:")) throw new Error("Storage quota");
    original(key, value);
  };
  const report = await startImport(h.api, source(), options).result;
  expect(
    report.findings.some(
      (f) => f.code === "AUDIT_STORAGE" && f.severity === "error",
    ),
  ).toBe(true);
  expect(readIndex(h.api, "BINDINGS").nodes.MASTER).toBeTruthy();
});
