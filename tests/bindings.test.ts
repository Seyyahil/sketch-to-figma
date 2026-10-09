import { ImportContext } from "../src/figma/context";
import { reconcileTextStyleBindings } from "../src/figma/text-style-bindings";
import { fingerprint } from "../src/core/math";
import { it, expect } from "vitest";
import { bindingFixture, changedBindings } from "./binding-fixture";
import { createHost } from "./mock-figma";
import { startImport } from "../src/figma/importer";
import { DEFAULT_OPTIONS, type Sketch } from "../src/core/types";
import {
  readIndex,
  writeIndex,
  targetFingerprint,
  capture,
  restore,
  readData,
} from "../src/figma/storage";
const options = {
  ...DEFAULT_OPTIONS,
  fallbackFont: { family: "Inter", style: "Regular" },
};
function target(h: ReturnType<typeof createHost>, id: string) {
  return h.nodes.get(readIndex(h.api, "BINDINGS").nodes[id].nodeId);
}
it("keeps named variable bindings in text, gradient stops, strokes and shadows", async () => {
  const h = createHost(),
    f = bindingFixture(),
    r = await startImport(h.api, f, options).result;
  const checks = r.validations.filter(
    (v) => v.kind === "variable-binding" || v.kind === "style-binding",
  );
  expect(checks.length).toBeGreaterThan(8);
  expect(
    checks.filter((v) => v.passed === false && v.sourceId !== "MIXED"),
  ).toEqual([]);
  const rect = target(h, "R");
  expect(
    rect.fills[0].gradientStops.every(
      (s: any) => s.boundVariables.color.type === "VARIABLE_ALIAS",
    ),
  ).toBe(true);
  expect(rect.effects[0].boundVariables.color.type).toBe("VARIABLE_ALIAS");
  const text = target(h, "T");
  expect(text.textStyleId).toBeTruthy();
  expect(text.fillStyleId).toBe("");
  expect(text.fills[0].boundVariables.color.id).toBe(
    readIndex(h.api, f.documentId).resources["color:C"],
  );
});
it("removes obsolete source overrides on an existing linked instance", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const id = target(h, "I").id;
  f.pages[0].layers.find((n: Sketch) => n.do_objectID === "I").overrideValues =
    [];
  const r = await startImport(h.api, f, {
    ...options,
    conflict: "replace-imported",
  }).result;
  expect(r.state).toBe("complete");
  expect(target(h, "I").id).toBe(id);
  expect(target(h, "I").children[0].characters).toBe("Default");
});
it("swaps changed source components and reuses resource IDs", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const before = structuredClone(readIndex(h.api, f.documentId)),
    count = h.styles.size,
    variables = h.variables.size;
  const r = await startImport(h.api, changedBindings(f), {
    ...options,
    conflict: "replace-imported",
  }).result;
  expect(r.state).toBe("complete");
  expect(target(h, "I").main.id).toBe(target(h, "MASTER2").id);
  expect(target(h, "I").children[0].characters).toBe("Secondary");
  // Explicit source overrides stay literal; the source library does not grow.
  expect(h.styles.size).toBe(count);
  expect(h.variables.size).toBe(variables);
  const after = readIndex(h.api, f.documentId).resources;
  for (const [key, id] of Object.entries(before.resources))
    expect(after[key]).toBe(id);
  expect(
    Object.keys(after).filter((key) => !(key in before.resources)),
  ).toHaveLength(0);
});
it("does not duplicate generated component properties when a source master changes", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const before = Object.keys(target(h, "MASTER").componentPropertyDefinitions);
  await startImport(h.api, changedBindings(f), {
    ...options,
    conflict: "replace-imported",
  }).result;
  expect(Object.keys(target(h, "MASTER").componentPropertyDefinitions)).toEqual(
    before,
  );
});
it("replaces edited styles under explicit source replacement even when the source style is unchanged", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const style = h.styles.get(
    readIndex(h.api, f.documentId).resources["text:TS"],
  );
  style.fontSize = 50;
  await startImport(h.api, f, { ...options, conflict: "replace-imported" })
    .result;
  expect(style.fontSize).toBe(16);
});
it("preserves local resource edits under the default conflict policy", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const style = h.styles.get(
    readIndex(h.api, f.documentId).resources["text:TS"],
  );
  style.fontSize = 50;
  await startImport(h.api, f, options).result;
  expect(style.fontSize).toBe(50);
});
it("reports unresolved named color references rather than claiming a bound conversion", async () => {
  const h = createHost(),
    f = bindingFixture();
  f.document.sharedSwatches.objects = [];
  const r = await startImport(h.api, f, options).result;
  expect(
    r.findings.some(
      (f) => f.code === "VARIABLE_REFERENCE" && f.severity === "error",
    ),
  ).toBe(true);
  expect(
    r.validations.some(
      (v) => v.kind === "variable-binding" && v.passed === false,
    ),
  ).toBe(true);
  expect(
    r.layers
      .find((l) => l.sourceId === "T")
      ?.properties.find(
        (p) =>
          p.path ===
          "/style/textStyle/encodedAttributes/MSAttributedStringColorAttribute/swatchID",
      )?.status,
  ).toBe("Unsupported");
});
it("clears a removed source style reference instead of retaining a stale binding", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  delete f.pages[0].layers.find((n: Sketch) => n.do_objectID === "MIXED")
    .sharedStyleID;
  await startImport(h.api, f, { ...options, conflict: "replace-imported" })
    .result;
  expect(target(h, "MIXED").textStyleId).toBe("");
});

it("retains mixed font sizes and reports incompatible original style bindings", async () => {
  const h = createHost(),
    r = await startImport(h.api, bindingFixture(), options).result,
    mixed = target(h, "MIXED");
  expect(mixed.getRangeFontSize(0, 6)).toBe(16);
  expect(mixed.getRangeFontSize(6, 11)).toBe(26);
  expect(mixed.getRangeTextStyleId(0, 6)).toBeTruthy();
  expect(mixed.getRangeTextStyleId(6, 11)).toBe("");
  expect(
    r.layers
      .find((l) => l.sourceId === "MIXED")
      ?.properties.find((p) => p.path === "/sharedStyleID")?.status,
  ).toBe("Partial");
});
it("preserves explicit source fill overrides instead of overwriting them with a shared Layer Style", async () => {
  const h = createHost(),
    f = bindingFixture(),
    rect = f.pages[0].layers.find((s: Sketch) => s.do_objectID === "R");
  rect.style.fills = [
    {
      fillType: 0,
      isEnabled: true,
      color: { red: 0.8, green: 0.1, blue: 0.2, alpha: 1 },
    },
  ];
  const r = await startImport(h.api, f, options).result;
  expect(target(h, "R").fills[0].color).toEqual({ r: 0.8, g: 0.1, b: 0.2 });
  expect(target(h, "R").fillStyleId).toBe("");
  expect(target(h, "R").fills[0].boundVariables?.color).toBeUndefined();
  expect([...h.styles.values()].some((s) => s.type === "PAINT")).toBe(false);
});
it("applies only supplied layout token relationships and reuses their variables", async () => {
  const h = createHost(),
    f = bindingFixture();
  const tokens = {
    collection: "Supplied",
    modes: ["Default"],
    tokens: [
      { name: "space", type: "FLOAT" as const, values: { Default: 8 } },
      {
        name: "padding",
        type: "FLOAT" as const,
        values: { Default: "{space}" },
      },
    ],
    bindings: [
      { sourceId: "MASTER", field: "paddingLeft", token: "padding" },
      { sourceId: "R", field: "topLeftRadius", token: "space" },
    ],
  };
  const r = await startImport(h.api, f, { ...options, tokens }).result;
  expect(
    r.validations
      .filter((v) => v.kind === "token-binding")
      .map((v) => v.passed),
  ).toEqual([true, true]);
  const index = readIndex(h.api, f.documentId),
    id = index.resources["tokens:Supplied:padding"];
  expect(target(h, "MASTER").boundVariables.paddingLeft.id).toBe(id);
  expect(target(h, "MASTER2").boundVariables.paddingLeft).toBeUndefined();
  const count = h.variables.size;
  await startImport(h.api, f, {
    ...options,
    tokens,
    conflict: "replace-imported",
  }).result;
  expect(h.variables.size).toBe(count);
});
it("does not treat a missing or incompatible supplied token as a converted binding", async () => {
  const h = createHost(),
    r = await startImport(h.api, bindingFixture(), {
      ...options,
      tokens: {
        collection: "Missing",
        modes: ["Default"],
        tokens: [],
        bindings: [
          { sourceId: "MASTER", field: "paddingLeft", token: "no-such-token" },
        ],
      },
    }).result;
  expect(
    r.findings.some(
      (f) => f.code === "TOKEN_BINDING" && f.severity === "error",
    ),
  ).toBe(true);
  expect(target(h, "MASTER").boundVariables.paddingLeft).toBeUndefined();
});

it("restores mixed text styles and color bindings after an interrupted update", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const mixed = target(h, "MIXED"),
    snapshot = capture(mixed);
  const first = mixed.getRangeTextStyleId(0, 6),
    override = mixed.getRangeTextStyleId(6, 11),
    paint = mixed.fillStyleId;
  mixed.characters = "Broken";
  mixed.fontSize = 99;
  mixed.fills = [];
  mixed.textStyleId = "";
  mixed.fillStyleId = "";
  await restore(h.api, mixed, snapshot);
  expect(mixed.characters).toBe("Small Large");
  expect(mixed.getRangeFontSize(0, 6)).toBe(16);
  expect(mixed.getRangeFontSize(6, 11)).toBe(26);
  expect(mixed.getRangeTextStyleId(0, 6)).toBe(first);
  expect(mixed.getRangeTextStyleId(6, 11)).toBe(override);
  expect(mixed.getRangeFillStyleId(0, 6)).toBe(paint);
});
it("audits supplied modes, token values, aliases and binding paths separately", async () => {
  const h = createHost(),
    f = bindingFixture(),
    tokens = {
      collection: "Exact",
      modes: ["Default"],
      tokens: [
        { name: "space", type: "FLOAT" as const, values: { Default: 8 } },
        {
          name: "padding",
          type: "FLOAT" as const,
          values: { Default: "{space}" },
        },
      ],
      bindings: [
        { sourceId: "MASTER", field: "paddingLeft", token: "padding" },
      ],
    };
  const r = await startImport(h.api, f, { ...options, tokens }).result,
    ledger = r.layers.find((l) => l.sourceType === "tokenFile")!;
  for (const path of [
    "/collection",
    "/modes/0",
    "/tokens/0/type",
    "/tokens/0/values/Default",
    "/tokens/1/values/Default",
    "/bindings/0/token",
  ])
    expect(ledger.properties.find((p) => p.path === path)?.status, path).toBe(
      "Native",
    );
});

it.each([16, 26])(
  "keeps supplied typography tokens and exact values through recovery at %dpx",
  async (size) => {
    const h = createHost(),
      f = bindingFixture(),
      tokens = {
        collection: "Typography",
        modes: ["Default"],
        tokens: [
          { name: "size", type: "FLOAT" as const, values: { Default: size } },
          {
            name: "family",
            type: "STRING" as const,
            values: { Default: "Inter" },
          },
        ],
        bindings: [
          { sourceId: "T", field: "fontSize", token: "size" },
          { sourceId: "T", field: "fontFamily", token: "family" },
        ],
      };
    const sourceText = f.pages[0].layers[0].layers[0];
    sourceText.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.size =
      size;
    sourceText.attributedString.attributes[0].attributes.MSAttributedStringFontAttribute.attributes.size =
      size;
    const r = await startImport(h.api, f, { ...options, tokens }).result,
      n = target(h, "T");
    expect(
      r.validations
        .filter((v) => v.kind === "token-binding")
        .map((v) => v.passed),
    ).toEqual([true, true]);
    const alias = n.getRangeBoundVariable(0, n.characters.length, "fontSize"),
      snapshot = capture(n);
    n.setBoundVariable("fontSize", null);
    await restore(h.api, n, snapshot);
    expect(n.getRangeBoundVariable(0, n.characters.length, "fontSize")).toEqual(
      alias,
    );
    expect(n.getRangeFontSize(0, n.characters.length)).toBe(size);
    expect(n.getRangeTextStyleId(0, n.characters.length)).toBe(
      size === 16 ? readIndex(h.api, f.documentId).resources["text:TS"] : "",
    );
    expect(
      [...h.styles.values()].filter((s) => s.type === "TEXT"),
    ).toHaveLength(1);
  },
);

it("restores the original text style after a temporary whole-layer override returns to style values on one range", async () => {
  const h = createHost(),
    f = bindingFixture();
  const mixed = f.pages[0].layers.find(
    (n: Sketch) => n.do_objectID === "MIXED",
  );
  mixed.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.size = 26;
  const r = await startImport(h.api, f, options).result;
  const styleId = readIndex(h.api, f.documentId).resources["text:TS"];
  const node = target(h, "MIXED");
  expect(node.getRangeFontSize(0, 6)).toBe(16);
  expect(node.getRangeTextStyleId(0, 6)).toBe(styleId);
  expect(node.getRangeFontSize(6, 11)).toBe(26);
  expect(node.getRangeTextStyleId(6, 11)).toBe("");
  expect([...h.styles.values()].filter((s) => s.type === "TEXT")).toHaveLength(
    1,
  );
  expect(
    r.findings.some(
      (f) => f.code === "TEXT_STYLE_OVERRIDE" && f.sourceId === "MIXED",
    ),
  ).toBe(true);
});

it("retains the source run color after a temporary color override without a Paint Style", async () => {
  const h = createHost(),
    f = bindingFixture();
  const text = f.pages[0].layers[0].layers[0];
  text.style.textStyle.encodedAttributes.MSAttributedStringColorAttribute = {
    red: 1,
    green: 0,
    blue: 0,
    alpha: 1,
  };
  await startImport(h.api, f, options).result;
  expect(target(h, "T").getRangeFillStyleId(0, 7)).toBe("");
  expect(target(h, "T").fills[0].boundVariables.color.id).toBe(
    readIndex(h.api, f.documentId).resources["color:C"],
  );
});

it("does not infer a Text Style for literal text or a historic detached-style reference", async () => {
  const h = createHost(),
    f = bindingFixture();
  const text = f.pages[0].layers[0].layers[0];
  delete text.sharedStyleID;
  text.userInfo = {
    "com.sketch.detach": { sharedStyle: { sharedStyleId: "TS" } },
  };
  await startImport(h.api, f, options).result;
  expect(target(h, "T").getRangeTextStyleId(0, 7)).toBe("");
  expect([...h.styles.values()].filter((s) => s.type === "TEXT")).toHaveLength(
    1,
  );
});

it("repairs an old importer result on unchanged-source reimport without replacing node or resource IDs", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const index = readIndex(h.api, f.documentId);
  const node = target(h, "T");
  await node.setTextStyleIdAsync("");
  // Simulate the saved state produced by an older converter, not a user's edit.
  for (const record of Object.values(index.nodes)) {
    delete record.conversionHash;
    record.targetHash = await targetFingerprint(h.nodes.get(record.nodeId));
  }
  for (const record of Object.values(index.resourceStates ?? {}))
    delete record.conversionHash;
  writeIndex(h.api, index);
  const count = h.styles.size;
  const r = await startImport(h.api, f, options).result;
  const after = readIndex(h.api, f.documentId);
  expect(r.state).toBe("complete");
  expect(r.created).toBe(0);
  expect(target(h, "T").id).toBe(node.id);
  expect(target(h, "T").getRangeTextStyleId(0, 7)).toBe(
    index.resources["text:TS"],
  );
  expect(after.resources).toEqual(index.resources);
  expect(h.styles.size).toBe(count);
  expect(Object.values(after.nodes).every((m) => !!m.conversionHash)).toBe(
    true,
  );
});

it("retains genuine local typography edits when upgrading an older import", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const index = readIndex(h.api, f.documentId);
  for (const record of Object.values(index.nodes)) delete record.conversionHash;
  writeIndex(h.api, index);
  target(h, "T").setRangeFontSize(0, 7, 23);
  const r = await startImport(h.api, f, options).result;
  expect(r.preserved).toBeGreaterThan(0);
  expect(target(h, "T").getRangeFontSize(0, 7)).toBe(23);
  expect(target(h, "T").getRangeTextStyleId(0, 7)).toBe("");
});

it("applies a changed explicit font mapping to unchanged source and existing local styles", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const id = target(h, "T").id;
  const styleId = readIndex(h.api, f.documentId).resources["text:TS"];
  await startImport(h.api, f, {
    ...options,
    fontMap: { "Inter-Regular": { family: "Arial", style: "Regular" } },
  }).result;
  expect(target(h, "T").id).toBe(id);
  expect(target(h, "T").getRangeFontName(0, 7)).toEqual({
    family: "Arial",
    style: "Regular",
  });
  expect(target(h, "T").getRangeTextStyleId(0, 7)).toBe(styleId);
  expect(h.styles.get(styleId).fontName).toEqual({
    family: "Arial",
    style: "Regular",
  });
});

it("validates text-style bindings inside linked and nested instances", async () => {
  const h = createHost();
  const r = await startImport(h.api, bindingFixture(), options).result;
  const checks = r.validations.filter(
    (v) => v.kind === "instance-text-style-binding",
  );
  expect(checks.length).toBeGreaterThanOrEqual(3);
  expect(checks.every((v) => v.passed === true)).toBe(true);
});

it("repairs a detached instance text style using its effective source style", async () => {
  const h = createHost(),
    create = h.api.createComponent;
  (h.api as any).createComponent = () => {
    const component = create(),
      createInstance = component.createInstance.bind(component);
    Object.defineProperty(component, "createInstance", {
      value: () => {
        const instance = createInstance();
        for (const text of instance.findAll(
          (n: SceneNode) => n.type === "TEXT",
        ) as any[]) {
          text.textStyleId = "";
          text.runs = text.runs.filter((r: any) => r.field !== "textStyleId");
        }
        return instance;
      },
    });
    return component;
  };
  const r = await startImport(h.api, bindingFixture(), options).result;
  expect(r.state, r.findings.map((f) => f.message).join("\n")).toBe("complete");
  expect(target(h, "T").getRangeTextStyleId(0, 7)).toBeTruthy();
  expect(
    r.validations.some(
      (v) => v.kind === "instance-text-style-binding" && v.passed === false,
    ),
  ).toBe(false);
  expect(r.findings.some((f) => f.code === "INSTANCE_TEXT_STYLE_BINDING")).toBe(
    false,
  );
});

it("validates a Symbol text-style override against the selected source style", async () => {
  const h = createHost(),
    f = bindingFixture();
  const secondStyle = structuredClone(f.document.layerTextStyles.objects[0]);
  secondStyle.do_objectID = "TS2";
  secondStyle.name = "Body / Large";
  secondStyle.value.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.size = 20;
  f.document.layerTextStyles.objects.push(secondStyle);
  f.pages[0].layers
    .find((n: Sketch) => n.do_objectID === "I")
    .overrideValues.push({ overrideName: "T_textStyle", value: "TS2" });
  const r = await startImport(h.api, f, options).result;
  const checks = r.validations.filter(
    (v) => v.kind === "instance-text-style-binding" && v.sourceId === "I",
  );
  expect(checks).toHaveLength(1);
  expect(checks[0].passed).toBe(true);
  expect(checks[0].expected).toMatchObject({ sourceStyleId: "TS2" });
});

it("retains nested Symbol identities and override targets when refreshing an older import", async () => {
  const h = createHost(),
    file = bindingFixture();
  await startImport(h.api, file, options).result;
  const before = readIndex(h.api, file.documentId),
    ids = Object.fromEntries(
      Object.entries(before.nodes).map(([id, n]) => [id, n.nodeId]),
    );
  for (const entry of Object.values(before.nodes)) delete entry.conversionHash;
  writeIndex(h.api, before);
  const result = await startImport(h.api, file, {
    ...options,
    conflict: "replace-imported",
  }).result;
  const after = readIndex(h.api, file.documentId);
  expect(result.created).toBe(0);
  expect(
    Object.fromEntries(
      Object.entries(after.nodes).map(([id, n]) => [id, n.nodeId]),
    ),
  ).toEqual(ids);
  expect(target(h, "INNER").getPluginData("sketch2figma:sourceId")).toBe(
    "INNER",
  );
  const nested = target(h, "NI").children[0];
  expect(nested.getPluginData("sketch2figma:sourceId")).toBe("INNER");
  expect(nested.children[0].characters).toBe("Nested custom");
  expect(
    result.validations.filter(
      (v) => v.kind === "component-override" && !v.passed,
    ),
  ).toEqual([]);
});

it("uses exact source names for every native representation without added folders or suffixes", async () => {
  const h = createHost(),
    file = bindingFixture();
  await startImport(h.api, file, options).result;
  const index = readIndex(h.api, file.documentId);
  for (const shared of [
    file.document.layerStyles.objects[0],
    file.document.layerTextStyles.objects[0],
  ]) {
    for (const kind of ["paint", "stroke", "effect", "text"]) {
      const id = index.resources[`${kind}:${shared.do_objectID}`];
      if (id) expect(h.styles.get(id).name).toBe(shared.name);
    }
  }
  for (const swatch of file.document.sharedSwatches.objects)
    expect(
      h.variables.get(index.resources[`color:${swatch.do_objectID}`]).name,
    ).toBe(swatch.name);
  expect(h.collections.get(index.resources["color-collection"]).name).toBe(
    file.name,
  );
});

it("renames source styles and variables in place while preserving source slashes", async () => {
  const h = createHost(),
    file = bindingFixture();
  await startImport(h.api, file, options).result;
  const before = structuredClone(readIndex(h.api, file.documentId).resources);
  file.document.sharedSwatches.objects[0].name =
    "Document Palette/Static/Exact Name";
  file.document.layerTextStyles.objects[0].name = "Type/Original / spaces";
  file.document.layerStyles.objects[0].name = "Original / Layer Style";
  await startImport(h.api, file, { ...options, conflict: "replace-imported" })
    .result;
  expect(readIndex(h.api, file.documentId).resources).toEqual(before);
  expect(h.variables.get(before["color:C"]).name).toBe(
    "Document Palette/Static/Exact Name",
  );
  expect(h.styles.get(before["text:TS"]).name).toBe("Type/Original / spaces");
  for (const kind of ["effect"])
    expect(h.styles.get(before[`${kind}:LS`]).name).toBe(
      "Original / Layer Style",
    );
});

it("removes the legacy effect suffix while preserving local effect edits", async () => {
  const h = createHost(),
    file = bindingFixture();
  await startImport(h.api, file, options).result;
  const index = readIndex(h.api, file.documentId),
    effect = h.styles.get(index.resources["effect:LS"]);
  effect.name += " / Effects";
  effect.effects = [];
  delete index.resourceStates!["effect:LS"].conversionHash;
  writeIndex(h.api, index);
  await startImport(h.api, file, options).result;
  expect(effect.name).toBe(file.document.layerStyles.objects[0].name);
  expect(effect.effects).toEqual([]);
  expect(readIndex(h.api, file.documentId).resources).toEqual(index.resources);
});

it("keeps compatible text bound throughout a source-name update without redundant font or content assignments", async () => {
  const h = createHost(),
    file = bindingFixture();
  await startImport(h.api, file, options).result;
  const node = target(h, "T"),
    id = node.id,
    styleId = node.getRangeTextStyleId(0, 7);
  const originalBind = node.setTextStyleIdAsync.bind(node);
  let applyingStyle = false,
    fontWrites = 0,
    characterWrites = 0,
    clears = 0;
  node.setTextStyleIdAsync = async (next: string) => {
    if (!next) clears++;
    applyingStyle = true;
    try {
      await originalBind(next);
    } finally {
      applyingStyle = false;
    }
  };
  let font = node.fontName;
  Object.defineProperty(node, "fontName", {
    configurable: true,
    enumerable: true,
    get: () => font,
    set: (value) => {
      if (!applyingStyle) fontWrites++;
      font = value;
    },
  });
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(node),
    "characters",
  )!;
  Object.defineProperty(node, "characters", {
    configurable: true,
    get: () => descriptor.get!.call(node),
    set: (value) => {
      characterWrites++;
      descriptor.set!.call(node, value);
    },
  });
  file.pages[0].layers[0].layers[0].name = "Renamed original text";
  const report = await startImport(h.api, file, {
    ...options,
    conflict: "replace-imported",
  }).result;
  expect(report.state).toBe("complete");
  expect(report.findings.filter((f) => f.code === "TEXT_FAILURE")).toEqual([]);
  expect(target(h, "T").id).toBe(id);
  expect(node.getRangeTextStyleId(0, 7)).toBe(styleId);
  expect({ clears, fontWrites, characterWrites }).toEqual({
    clears: 0,
    fontWrites: 0,
    characterWrites: 0,
  });
});

it.each([true, false])(
  "keeps exact semantic overrides with host retention=%s without additional styles",
  async (semanticOverrides) => {
    const h = createHost({ semanticOverrides }),
      f = bindingFixture();
    const mixed = f.pages[0].layers.find(
      (s: Sketch) => s.do_objectID === "MIXED",
    );
    mixed.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.size = 26;
    mixed.attributedString.attributes[0].attributes.MSAttributedStringFontAttribute.attributes.name =
      "Arial-Bold";
    // Use the same font family as the original; only weight and decoration differ.
    f.document.layerTextStyles.objects[0].value.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.name =
      "Arial-Regular";
    mixed.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.name =
      "Arial-Regular";
    mixed.attributedString.attributes[1].attributes.MSAttributedStringFontAttribute.attributes.name =
      "Arial-Regular";
    mixed.attributedString.attributes[0].attributes.underlineStyle = 1;
    const r = await startImport(h.api, f, options).result;
    const n = target(h, "MIXED"),
      original = readIndex(h.api, f.documentId).resources["text:TS"];
    expect(n.getRangeFontName(0, 6)).toEqual({
      family: "Arial",
      style: "Bold",
    });
    expect(n.getRangeTextDecoration(0, 6)).toBe("UNDERLINE");
    expect(n.getRangeFontSize(0, 6)).toBe(16);
    expect(n.getRangeTextStyleId(0, 6)).toBe(semanticOverrides ? original : "");
    expect(n.getRangeTextStyleId(0, 6) === original).toBe(semanticOverrides);
    expect(r.findings.filter((f) => f.code === "API_REJECTED")).toEqual([]);
  },
);

it("keeps source overrides literal across pages and unchanged reimports", async () => {
  const h = createHost(),
    f = bindingFixture();
  const duplicate = structuredClone(
    f.pages[0].layers.find((s: Sketch) => s.do_objectID === "MIXED"),
  );
  duplicate.do_objectID = "MIXED2";
  f.pages.push({
    _class: "page",
    do_objectID: "P2",
    name: "Source page 2",
    layers: [duplicate],
  });
  await startImport(h.api, f, options).result;
  const original = structuredClone(readIndex(h.api, f.documentId)),
    count = h.styles.size;
  for (const id of ["MIXED", "MIXED2"]) {
    expect(target(h, id).getRangeTextStyleId(6, 11)).toBe("");
    expect(target(h, id).getRangeFontSize(6, 11)).toBe(26);
  }
  const r = await startImport(h.api, f, options).result;
  expect(r.created).toBe(0);
  expect(h.styles.size).toBe(count);
  expect(readIndex(h.api, f.documentId).resources).toEqual(original.resources);
});

it("never invents Color Styles or additional Text Styles, even when the host rejects them", async () => {
  const h = createHost(),
    create = h.api.createTextStyle;
  h.api.createPaintStyle = () => {
    throw new Error("No Color Styles allowed");
  };
  let count = 0;
  h.api.createTextStyle = () => {
    if (++count > 1) throw new Error("No additional Text Styles allowed");
    return create();
  };
  const r = await startImport(h.api, bindingFixture(), options).result;
  expect(r.state).toBe("complete");
  expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
  expect(count).toBe(1);
  expect(target(h, "MIXED").getRangeFontSize(6, 11)).toBe(26);
  expect(
    r.validations.some(
      (v) => v.sourceId === "MIXED" && v.kind === "style-binding" && !v.passed,
    ),
  ).toBe(true);
});

it("keeps literal colors literal even when their values match a source variable", async () => {
  const h = createHost(),
    f = bindingFixture();
  const rect = f.pages[0].layers.find((s: Sketch) => s.do_objectID === "R");
  rect.style.fills = [
    {
      fillType: 0,
      isEnabled: true,
      color: { red: 0.2, green: 0.4, blue: 0.8, alpha: 1 },
    },
  ];
  await startImport(h.api, f, options).result;
  expect(target(h, "R").fills[0].color).toEqual({ r: 0.2, g: 0.4, b: 0.8 });
  expect(target(h, "R").fills[0].boundVariables?.color).toBeUndefined();
  expect(target(h, "R").fillStyleId).toBe("");
  expect([...h.styles.values()].filter((s) => s.type === "PAINT")).toHaveLength(
    0,
  );
});

it("keeps master style audits independent of instance-specific text-style swaps", async () => {
  const h = createHost(),
    f = bindingFixture(),
    masterText = f.pages[0].layers[0].layers[0];
  masterText.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute.attributes.size = 26;
  masterText.attributedString.attributes[0].attributes.MSAttributedStringFontAttribute.attributes.size = 26;
  const second = structuredClone(f.document.layerTextStyles.objects[0]);
  second.do_objectID = "TS2";
  second.name = "Source alternative";
  f.document.layerTextStyles.objects.push(second);
  f.pages[0].layers
    .find((s: Sketch) => s.do_objectID === "I")
    .overrideValues.push({ overrideName: "T_textStyle", value: "TS2" });
  const r = await startImport(h.api, f, options).result;
  expect(
    r.layers
      .find((l) => l.sourceId === "T")
      ?.properties.find((p) => p.path === "/sharedStyleID")?.status,
  ).toBe("Partial");
  expect(target(h, "I").children[0].getRangeTextStyleId(0, 6)).toBe(
    readIndex(h.api, f.documentId).resources["text:TS2"],
  );
});

it("removes only unused unchanged importer-generated paint styles on reimport", async () => {
  const h = createHost(),
    f = bindingFixture();
  await startImport(h.api, f, options).result;
  const index = readIndex(h.api, f.documentId);
  const legacy = ["unused", "edited", "referenced"].map((name) => {
    const style = h.api.createPaintStyle();
    style.name = name;
    style.paints = [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 } }];
    const key = `paint:${name}`;
    index.resources[key] = style.id;
    index.resourceStates![key] = {
      sourceHash: "old",
      targetHash: fingerprint({ name: style.name, paints: style.paints }),
    };
    return style;
  });
  const unrelated = h.api.createPaintStyle();
  unrelated.name = "User's style";
  legacy[1].name = "User edited";
  const local = h.api.createRectangle();
  await local.setFillStyleIdAsync(legacy[2].id);
  writeIndex(h.api, index);
  const r = await startImport(h.api, f, options).result;
  expect(h.styles.has(legacy[0].id)).toBe(false);
  expect(h.styles.has(legacy[1].id)).toBe(true);
  expect(h.styles.has(legacy[2].id)).toBe(true);
  expect(h.styles.has(unrelated.id)).toBe(true);
  expect(
    r.findings.filter((f) => f.code === "LEGACY_STYLE_RETAINED"),
  ).toHaveLength(2);
  expect(
    readIndex(h.api, f.documentId).resources["paint:unused"],
  ).toBeUndefined();
});

it("repairs empty styled text in linked and nested instances without querying an empty range", async () => {
  const h = createHost(),
    file = bindingFixture(),
    create = h.api.createComponent;
  const text = file.pages[0].layers[0].layers[0];
  text.attributedString.string = "";
  text.attributedString.attributes = [];
  for (const layer of file.pages[0].layers)
    for (const override of layer.overrideValues ?? [])
      if (override.overrideName.endsWith("_stringValue")) override.value = "";
  h.api.createComponent = () => {
    const component = create(),
      createInstance = component.createInstance.bind(component);
    Object.defineProperty(component, "createInstance", {
      value: () => {
        const instance = createInstance();
        for (const node of instance.findAll(
          (n) => n.type === "TEXT",
        ) as any[]) {
          node.textStyleId = "";
          node.runs = node.runs.filter((r: any) => r.field !== "textStyleId");
        }
        return instance;
      },
    });
    return component;
  };
  const report = await startImport(h.api, file, options).result;
  expect(
    report.findings.filter((f) => f.severity === "error"),
    JSON.stringify(report.findings.filter((f) => f.severity === "error")),
  ).toEqual([]);
  const style = readIndex(h.api, file.documentId).resources["text:TS"];
  for (const node of [
    target(h, "T"),
    target(h, "I").children[0],
    target(h, "NI").children[0].children[0],
  ]) {
    expect(node.characters).toBe("");
    expect(node.textStyleId).toBe(style);
  }
  expect(
    report.validations.filter(
      (v) => v.kind === "instance-text-style-binding" && !v.passed,
    ),
  ).toEqual([]);
});

it("tries size overrides and keeps the source style when the host retains both binding and typography", async () => {
  const h = createHost(),
    create = h.api.createText;
  h.api.createText = () => {
    const node = create() as any,
      setSize = node.setRangeFontSize.bind(node);
    // A host that supports this override must not be rejected by a hardcoded whitelist.
    Object.defineProperty(node, "setRangeFontSize", {
      value: (start: number, end: number, size: number) => {
        const style = node.getRangeTextStyleId(start, end);
        setSize(start, end, size);
        node.runs.push({ field: "textStyleId", start, end, value: style });
      },
    });
    return node;
  };
  const file = bindingFixture();
  const mixed = file.pages[0].layers.find(
    (s: Sketch) => s.do_objectID === "MIXED",
  );
  // Detach the initial binding through the temporary layer-level line-height override.
  mixed.style.textStyle.encodedAttributes.paragraphStyle.maximumLineHeight = 30;
  mixed.style.textStyle.encodedAttributes.paragraphStyle.minimumLineHeight = 30;
  const report = await startImport(h.api, file, options).result;
  expect(
    report.state,
    JSON.stringify(report.findings.filter((f) => f.severity === "error")),
  ).toBe("complete");
  const node = target(h, "MIXED"),
    style = readIndex(h.api, file.documentId).resources["text:TS"];
  expect(node.getRangeFontSize(6, 11)).toBe(26);
  expect(node.getRangeLineHeight(6, 11)).toEqual({ unit: "PIXELS", value: 24 });
  expect(node.getRangeTextStyleId(6, 11)).toBe(style);
  expect(
    report.findings.filter(
      (f) => f.sourceId === "MIXED" && f.code === "TEXT_STYLE_OVERRIDE",
    ),
  ).toEqual([]);
});

it("reports unresolved live source styles instead of silently accepting unbound text", async () => {
  const h = createHost(),
    file = bindingFixture();
  file.document.layerTextStyles.objects = [];
  const report = await startImport(h.api, file, options).result;
  expect(
    report.findings.some(
      (f) =>
        f.sourceId === "T" &&
        f.code === "TEXT_STYLE_REFERENCE" &&
        f.severity === "error",
    ),
  ).toBe(true);
  expect(target(h, "T").characters).toBe("Default");
  expect([...h.styles.values()].filter((s) => s.type === "TEXT")).toHaveLength(
    0,
  );
});

it("removes an earlier unbound-range warning when final reconciliation restores the original style", async () => {
  const h = createHost(),
    file = bindingFixture();
  const report = await startImport(h.api, file, options).result;
  expect(
    report.findings.some(
      (f) => f.sourceId === "MIXED" && f.code === "TEXT_STYLE_OVERRIDE",
    ),
  ).toBe(true);
  const index = readIndex(h.api, file.documentId),
    node = target(h, "MIXED");
  const ctx = new ImportContext(
    h.api,
    file,
    options,
    report,
    index,
    { track() {}, trackResource() {}, async before() {} },
    () => {},
  );
  ctx.resources.texts.set("TS", h.styles.get(index.resources["text:TS"]));
  node.setRangeFontSize(6, 11, 16);
  await reconcileTextStyleBindings(
    ctx,
    file.pages[0].layers.find((s: Sketch) => s.do_objectID === "MIXED"),
    node,
  );
  expect(node.getRangeTextStyleId(0, 11)).toBe(index.resources["text:TS"]);
  expect(
    report.findings.filter(
      (f) => f.sourceId === "MIXED" && f.code === "TEXT_STYLE_OVERRIDE",
    ),
  ).toEqual([]);
});
