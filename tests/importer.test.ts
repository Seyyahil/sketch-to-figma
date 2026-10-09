import { it, expect, describe } from "vitest";
import { bindingFixture } from "./binding-fixture";
import {
  DEFAULT_OPTIONS,
  sourceId,
  walkLayers,
  type SketchFile,
} from "../src/core/types";
import { startImport } from "../src/figma/importer";
import { readIndex, readData } from "../src/figma/storage";
import { createHost } from "./mock-figma";
import { layoutDistributionFixture } from "./layout-distribution-fixture";
const options = {
  ...DEFAULT_OPTIONS,
  fallbackFont: { family: "Inter", style: "Regular" },
};
const simple = (): SketchFile => ({
  name: "test.sketch",
  documentId: "DOC",
  version: 144,
  digest: "x",
  document: { do_objectID: "DOC", pages: [], colorSpace: 1 },
  meta: { version: 144 },
  user: {},
  assets: [],
  warnings: [],
  pages: [
    {
      _class: "page",
      do_objectID: "P",
      name: "Page",
      layers: [
        {
          _class: "artboard",
          do_objectID: "A",
          name: "Screen",
          frame: { x: 100, y: 100, width: 300, height: 200 },
          layers: [
            {
              _class: "rectangle",
              do_objectID: "R",
              name: "Rect",
              frame: { x: 10, y: 20, width: 100, height: 50 },
              isVisible: true,
              style: {
                fills: [
                  {
                    fillType: 0,
                    isEnabled: true,
                    color: { red: 1, green: 0, blue: 0, alpha: 1 },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
});
describe("import orchestration", () => {
  it("reuses IDs and resource counts on repeated import", async () => {
    const h = createHost(),
      f = bindingFixture();
    await startImport(h.api, f, options).result;
    const before = readIndex(h.api, f.documentId),
      count = h.nodes.size,
      styleCount = h.styles.size;
    const r = await startImport(h.api, f, options).result;
    expect(r.state).toBe("complete");
    expect(h.nodes.size).toBe(count);
    expect(h.styles.size).toBe(styleCount);
    expect(readIndex(h.api, f.documentId)).toEqual(before);
  });
  it("expands a selective import without duplicating its parent", async () => {
    const h = createHost(),
      f = simple();
    const second = structuredClone(f.pages[0].layers[0].layers[0]);
    second.do_objectID = "R2";
    f.pages[0].layers[0].layers.push(second);
    await startImport(h.api, f, { ...options, selectedIds: ["R"] }).result;
    const parent = readIndex(h.api, "DOC").nodes.A.nodeId;
    const r = await startImport(h.api, f, options).result;
    expect(r.state).toBe("complete");
    const index = readIndex(h.api, "DOC");
    expect(index.nodes.A.nodeId).toBe(parent);
    expect(h.nodes.get(index.nodes.R2.nodeId).parent.id).toBe(parent);
  });
  it("keeps linked instances and text override content", async () => {
    const h = createHost(),
      f = bindingFixture(),
      r = await startImport(h.api, f, options).result;
    const instance = walkLayers(f.pages).find((n) => sourceId(n) === "I")!;
    const index = readIndex(h.api, f.documentId),
      target = h.nodes.get(index.nodes[sourceId(instance)].nodeId);
    expect(target.type).toBe("INSTANCE");
    expect(target.main.type).toBe("COMPONENT");
    const text = target.children.find((n: any) => n.type === "TEXT");
    expect(text.characters).toBe("Custom");
    expect(r.findings.filter((f) => f.code === "OVERRIDE_TARGET")).toHaveLength(
      0,
    );
  });
  it("preserves local edits and allows a later explicit source replacement", async () => {
    const h = createHost(),
      f = simple();
    await startImport(h.api, f, options).result;
    const first = readIndex(h.api, "DOC"),
      rect = h.nodes.get(first.nodes.R.nodeId);
    rect.name = "Local name";
    const changed = structuredClone(f);
    changed.pages[0].layers[0].layers[0].name = "Source change";
    const preserved = await startImport(h.api, changed, options).result;
    expect(rect.name).toBe("Local name");
    expect(preserved.preserved).toBeGreaterThan(0);
    const replaced = await startImport(h.api, changed, {
      ...options,
      conflict: "replace-imported",
    }).result;
    expect(replaced.state).toBe("complete");
    expect(h.nodes.get(first.nodes.R.nodeId).name).toBe("Source change");
  });
  it("cancels a fresh import and removes created content/resources", async () => {
    const h = createHost(),
      f = simple(),
      count = h.nodes.size;
    const run = startImport(h.api, f, options);
    run.cancel();
    const r = await run.result;
    expect(r.state).toBe("cancelled");
    expect(h.nodes.size).toBe(count);
    expect(readData(h.api.root, "journal", null)).toBe(null);
  });
  it("rolls back changes to existing content on interrupted reimport", async () => {
    const h = createHost(),
      f = simple();
    await startImport(h.api, f, options).result;
    const index = readIndex(h.api, "DOC"),
      n = h.nodes.get(index.nodes.R.nodeId),
      before = n.width;
    const changed = structuredClone(f);
    changed.pages[0].layers[0].layers[0].frame.width = 150;
    let run: ReturnType<typeof startImport>;
    run = startImport(h.api, changed, options, [], (done) => {
      if (done > 0) run.cancel();
    });
    const r = await run.result;
    expect(r.state).toBe("cancelled");
    expect(n.removed).toBe(false);
    expect(n.width).toBe(before);
    expect(readIndex(h.api, "DOC")).toEqual(index);
  });
  it("never claims rejected paint assignments as native", async () => {
    const h = createHost(),
      create = h.api.createRectangle;
    (h.api as any).createRectangle = () => {
      const n = create();
      Object.defineProperty(n, "fills", {
        get: () => [],
        set: () => {
          throw new Error("Paint rejected by host");
        },
      });
      return n;
    };
    const r = await startImport(h.api, simple(), options).result;
    expect(r.findings.some((f) => f.code === "API_REJECTED")).toBe(true);
    const properties = r.layers.find((l) => l.sourceId === "R")!.properties;
    expect(
      properties.find((p) => p.path === "/style/fills/0/color/red")?.status,
    ).toBe("Unsupported");
  });
  it("keeps mask coordinates and removes obsolete wrappers after reimport", async () => {
    const h = createHost(),
      f = simple();
    const mask = f.pages[0].layers[0].layers[0];
    mask.hasClippingMask = true;
    mask.clippingMaskMode = 0;
    const child = structuredClone(mask);
    child.do_objectID = "M";
    child.hasClippingMask = false;
    f.pages[0].layers[0].layers.push(child);
    await startImport(h.api, f, options).result;
    const changed = structuredClone(f);
    changed.pages[0].layers[0].name = "Updated parent";
    await startImport(h.api, changed, {
      ...options,
      conflict: "replace-imported",
    }).result;
    const wrappers = [...h.nodes.values()].filter(
      (n) => n.getPluginData("sketch2figma:wrapper") === "mask",
    );
    expect(wrappers).toHaveLength(1);
    const paints = [...h.nodes.values()].filter(
      (n) => n.getPluginData("sketch2figma:wrapper") === "outline-paint",
    );
    expect(paints).toHaveLength(1);
    expect(paints[0].isMask).toBe(false);
    expect(paints[0].fills[0].color.r).toBe(1);
    expect(paints[0].getPluginData("sketch2figma:sourceId")).toBe("");
    const n = h.nodes.get(readIndex(h.api, "DOC").nodes.M.nodeId);
    expect(n.x).toBe(10);
    expect(n.y).toBe(20);
  });
  it("restores freeform container placement after intrinsic Auto Layout recalculation", async () => {
    const h = createHost(),
      file = simple();
    const group: any = structuredClone(file.pages[0].layers[0]);
    group._class = "group";
    group.do_objectID = "STACK";
    group.frame = { x: 35, y: 25, width: 154, height: 75 };
    group.horizontalSizing = group.verticalSizing = 0;
    group.groupLayout = {
      _class: "MSImmutableFlexGroupLayout",
      flexDirection: 0,
      justifyContent: 0,
      alignItems: 0,
      allGuttersGap: 0,
    };
    file.pages[0].layers[0].layers = [group];
    const create = h.api.createFrame;
    h.api.createFrame = () => {
      const node = create();
      let mode = node.layoutMode;
      Object.defineProperty(node, "layoutMode", {
        configurable: true,
        get: () => mode,
        set: (value) => {
          mode = value;
          if (value === "HORIZONTAL") node.x -= 77;
        },
      });
      return node;
    };
    const result = await startImport(h.api, file, options).result;
    expect(result.state).toBe("complete");
    const node = h.nodes.get(readIndex(h.api, "DOC").nodes.STACK.nodeId);
    expect(node.x).toBe(35);
    expect(node.y).toBe(25);
    expect(node.layoutMode).toBe("HORIZONTAL");
  });
  it("reports unknown properties and never flattens them", async () => {
    const h = createHost(),
      f = simple();
    f.pages[0].layers[0].layers[0].futureEffect = { amplitude: 3 };
    const r = await startImport(h.api, f, options).result;
    expect(
      r.layers
        .find((l) => l.sourceId === "R")!
        .properties.find((p) => p.path === "/futureEffect/amplitude")?.status,
    ).toBe("Unsupported");
    expect(h.nodes.get(readIndex(h.api, "DOC").nodes.R.nodeId).type).toBe(
      "RECTANGLE",
    );
  });
});

it.each([
  [4, "SPACE_AROUND"],
  [5, "SPACE_EVENLY"],
] as const)(
  "maps Sketch distribution %s to native %s",
  async (distribution, expected) => {
    const h = createHost(),
      file = layoutDistributionFixture();
    const result = await startImport(h.api, file, options).result;
    const index = readIndex(h.api, file.documentId);
    for (const axis of ["H", "V"]) {
      const node = h.nodes.get(
        index.nodes[`DISTRIBUTION_${axis}_${distribution}`].nodeId,
      );
      expect(node.primaryAxisAlignItems).toBe(expected);
    }
    expect(
      result.findings.filter(
        (f) => f.code === "STACK_DISTRIBUTION" || f.code === "API_REJECTED",
      ),
    ).toEqual([]);
  },
);
it.each([
  ["Around", "SPACE_AROUND"],
  ["Evenly", "SPACE_EVENLY"],
] as const)(
  "maps supplied sidecar %s distribution to %s",
  async (distribution, expected) => {
    const h = createHost(),
      file = simple();
    file.pages[0].layers[0].bridge = {
      stackLayout: {
        direction: "Row",
        justifyContent: distribution,
        alignItems: "Start",
        padding: 0,
        gap: 0,
      },
    };
    const result = await startImport(h.api, file, options).result;
    expect(
      h.nodes.get(readIndex(h.api, "DOC").nodes.A.nodeId).primaryAxisAlignItems,
    ).toBe(expected);
    expect(
      result.findings.filter((f) => f.code === "STACK_DISTRIBUTION"),
    ).toEqual([]);
  },
);

it("preserves serialized Stack overlap order, border mode and per-axis limits across reimport", async () => {
  const file = simple(),
    h = createHost();
  const stack = file.pages[0].layers[0],
    child = stack.layers[0];
  stack.groupLayout = {
    _class: "MSImmutableFlexGroupLayout",
    flexDirection: 0,
    justifyContent: 0,
    alignItems: 1,
    alignContent: 0,
    allGuttersGap: -4,
    stackingOrder: 1,
    bordersAffectLayout: true,
    wrappingEnabled: false,
  };
  stack.topPadding = 3;
  stack.rightPadding = 5;
  stack.bottomPadding = 7;
  stack.leftPadding = 9;
  child.minSize = "{20, 0}";
  child.maxSize = "{120, 80}";
  child.horizontalSizing = 0;
  child.verticalSizing = 0;
  child.flexItem = {
    _class: "MSImmutableFlexItem",
    alignSelf: 5,
    ignoreLayout: false,
    preserveSpaceWhenHidden: false,
  };
  const first = await startImport(h.api, file, options).result;
  const index = readIndex(h.api, file.documentId),
    parent = h.nodes.get(index.nodes.A.nodeId),
    target = h.nodes.get(index.nodes.R.nodeId);
  expect(parent.itemReverseZIndex).toBe(false);
  expect(parent.strokesIncludedInLayout).toBe(true);
  expect(parent.itemSpacing).toBe(-4);
  expect([
    target.minWidth,
    target.minHeight,
    target.maxWidth,
    target.maxHeight,
  ]).toEqual([20, null, 120, 80]);
  expect(
    first.validations
      .filter((v) => ["stack-layout", "layout-limits"].includes(v.kind))
      .every((v) => v.passed),
  ).toBe(true);
  expect(
    first.layers
      .find((l) => l.sourceId === "A")
      ?.properties.find((p) => p.path === "/groupLayout/bordersAffectLayout")
      ?.status,
  ).toBe("Partial");
  child.minSize = child.maxSize = "{0, 0}";
  stack.groupLayout.stackingOrder = 0;
  stack.groupLayout.bordersAffectLayout = false;
  const next = await startImport(h.api, file, {
    ...options,
    conflict: "replace-imported",
  }).result;
  expect(next.created).toBe(0);
  expect(parent.itemReverseZIndex).toBe(true);
  expect(parent.strokesIncludedInLayout).toBe(false);
  expect([
    target.minWidth,
    target.minHeight,
    target.maxWidth,
    target.maxHeight,
  ]).toEqual([null, null, null, null]);
});
