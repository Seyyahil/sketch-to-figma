import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  sourceId,
  walkLayers,
  type Sketch,
  type SketchFile,
} from "../src/core/types";
import {
  smartLayoutAffixPlan,
  smartLayoutPlan,
} from "../src/figma/smart-layout";
import { startImport } from "../src/figma/importer";
import { mapping, readData, readIndex, writeData } from "../src/figma/storage";
import { createHost } from "./mock-figma";

const rectangle = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Sketch => ({
  _class: "rectangle",
  do_objectID: id,
  name: id,
  frame: { x, y, width, height },
  horizontalSizing: 0,
  verticalSizing: 0,
});
const group = (children: Sketch[], axis = 1): Sketch => ({
  _class: "group",
  do_objectID: "GROUP",
  name: "Legacy layout",
  frame: { x: 50, y: 70, width: 300, height: 240 },
  groupLayout: {
    _class: "MSImmutableInferredGroupLayout",
    axis,
    layoutAnchor: 0,
  },
  layers: children,
});
const archive = (container: Sketch): SketchFile => ({
  name: "legacy-layout.sketch",
  documentId: "LEGACY",
  digest: "source",
  version: 196,
  meta: { version: 196 },
  user: {},
  assets: [],
  warnings: [],
  document: { do_objectID: "LEGACY" },
  pages: [
    {
      _class: "page",
      do_objectID: "PAGE",
      name: "Source",
      layers: [container],
    },
  ],
});
const options = {
  ...DEFAULT_OPTIONS,
  fallbackFont: { family: "Inter", style: "Regular" },
};

it("keeps legacy label and trailing-icon insets when a wider instance overrides its label", async () => {
  const background = rectangle("BG", 0, 0, 212, 56);
  const label: Sketch = {
    _class: "text",
    do_objectID: "LABEL",
    name: "Label",
    frame: { x: 32.5, y: 11, width: 110, height: 28 },
    resizingConstraint: 45,
    attributedString: { string: "Button label", attributes: [] },
  };
  const affix: Sketch = {
    _class: "symbolInstance",
    do_objectID: "AFFIX",
    symbolID: "ICON",
    name: "Trailing icon",
    resizingConstraint: 63,
    frame: { x: 152, y: 14, width: 28, height: 28 },
  };
  const button: Sketch = {
    ...group([background, label, affix], 0),
    _class: "symbolMaster",
    symbolID: "BUTTON",
    frame: { x: 0, y: 0, width: 212, height: 56 },
  };
  const file = archive(button);
  file.pages[0].layers.unshift({
    _class: "symbolMaster",
    do_objectID: "ICON_MASTER",
    symbolID: "ICON",
    name: "Icon",
    frame: { x: 300, y: 0, width: 28, height: 28 },
    layers: [rectangle("ICON_SHAPE", 0, 0, 28, 28)],
  });
  const host = createHost();
  await startImport(host.api, file, options).result;
  const text = target(host, file, "LABEL"),
    icon = target(host, file, "AFFIX");
  expect(text.constraints).toEqual({ horizontal: "MIN", vertical: "CENTER" });
  expect(icon.constraints).toEqual({ horizontal: "MAX", vertical: "CENTER" });
  expect([text.x, text.y, icon.x, icon.y, icon.width, icon.height]).toEqual([
    32.5, 11, 152, 14, 28, 28,
  ]);
  // Independent native constraint calculation for the supplied instance size:
  // a fixed right inset moves the icon by the parent's 75px width increase;
  // an auto-width label grows to 182px without moving its left inset.
  const resized = {
    labelLeft: text.x,
    labelRight: text.x + 182,
    iconLeft: 287 - (212 - icon.x),
  };
  expect(resized).toEqual({
    labelLeft: 32.5,
    labelRight: 214.5,
    iconLeft: 227,
  });
  expect(resized.labelRight).toBeLessThan(resized.iconLeft);
  expect(target(host, file, "GROUP").layoutMode).toBe("NONE");
  expect(readData<Sketch>(text, "source", {}).resizingConstraint).toBe(45);
  const second = await startImport(host.api, file, options).result;
  expect(second.updated).toBe(0);
  expect(target(host, file, "AFFIX").id).toBe(icon.id);

  expect(
    smartLayoutAffixPlan({
      ...button,
      groupLayout: { ...button.groupLayout, layoutAnchor: 1 },
    }),
  ).toBeUndefined();
  expect(
    smartLayoutAffixPlan({
      ...button,
      layers: [background, { ...label, textBehaviour: 2 }, affix],
    }),
  ).toBeUndefined();
  expect(
    smartLayoutAffixPlan({
      ...button,
      layers: [
        background,
        label,
        { ...affix, frame: { ...affix.frame, x: 90 } },
      ],
    }),
  ).toBeUndefined();
});

function target(
  host: ReturnType<typeof createHost>,
  file: SketchFile,
  id: string,
): any {
  return host.nodes.get(readIndex(host.api, file.documentId).nodes[id].nodeId);
}

/** Independent fixed-size flex calculation; the normal host double does not reflow nodes. */
function predictedPositions(node: any): Map<string, { x: number; y: number }> {
  const horizontal = node.layoutMode === "HORIZONTAL";
  const items = node.children.filter(
    (child: any) => child.visible && child.layoutPositioning !== "ABSOLUTE",
  );
  let cursor = horizontal ? node.paddingLeft : node.paddingTop;
  const start = horizontal ? node.paddingTop : node.paddingLeft;
  const cross = horizontal
    ? node.height - node.paddingTop - node.paddingBottom
    : node.width - node.paddingLeft - node.paddingRight;
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of items) {
    const childCross = horizontal ? child.height : child.width;
    const offset =
      start +
      (node.counterAxisAlignItems === "CENTER"
        ? (cross - childCross) / 2
        : node.counterAxisAlignItems === "MAX"
          ? cross - childCross
          : 0);
    positions.set(
      child.getPluginData("sketch2figma:sourceId"),
      horizontal ? { x: cursor, y: offset } : { x: offset, y: cursor },
    );
    cursor += (horizontal ? child.width : child.height) + node.itemSpacing;
  }
  return positions;
}

describe("legacy Smart Layout source geometry", () => {
  it("keeps overlapping overlays and modal contents in their source hierarchy and positions", async () => {
    const content = group([
      rectangle("BG", 0, 0, 300, 240),
      rectangle("TEXT", 80, 60, 140, 40),
    ]);
    const file = archive(content),
      host = createHost();
    const result = await startImport(host.api, file, options).result;
    const parent = target(host, file, "GROUP");
    expect(result.state).toBe("complete");
    expect(parent.layoutMode).toBe("NONE");
    expect(
      parent.children.map((child: any) =>
        child.getPluginData("sketch2figma:sourceId"),
      ),
    ).toEqual(["BG", "TEXT"]);
    expect([
      target(host, file, "TEXT").x,
      target(host, file, "TEXT").y,
    ]).toEqual([80, 60]);
    expect([parent.width, parent.height]).toEqual([300, 240]);
    expect(
      result.findings.some(
        (finding) => finding.code === "SMART_LAYOUT_GEOMETRY",
      ),
    ).toBe(true);
    expect(readData<Sketch>(parent, "source", {}).groupLayout).toEqual(
      content.groupLayout,
    );
  });
  it("preserves nonuniform gaps rather than replacing them with an average", async () => {
    const source = group([
      rectangle("C", 40, 150, 80, 20),
      rectangle("B", 40, 80, 80, 20),
      rectangle("A", 40, 10, 80, 40),
    ]);
    const file = archive(source),
      host = createHost();
    await startImport(host.api, file, options).result;
    expect(target(host, file, "GROUP").layoutMode).toBe("NONE");
    expect(
      source.layers.map(
        (child: Sketch) => target(host, file, sourceId(child)).y,
      ),
    ).toEqual([150, 80, 10]);
  });
  it.each([0, 1])(
    "reproduces compatible linear positions, cross alignment and source paint order (axis %s)",
    async (axis) => {
      const children =
        axis === 0
          ? [rectangle("A", 20, 70, 40, 40), rectangle("B", 80, 80, 60, 20)]
          : [rectangle("A", 70, 20, 40, 40), rectangle("B", 80, 80, 20, 60)];
      const source = group([...children].reverse(), axis);
      const file = archive(source),
        host = createHost();
      await startImport(host.api, file, options).result;
      const node = target(host, file, "GROUP"),
        positions = predictedPositions(node);
      expect(node.layoutMode).toBe(axis === 0 ? "HORIZONTAL" : "VERTICAL");
      expect(node.counterAxisAlignItems).toBe("CENTER");
      expect(node.itemReverseZIndex).toBe(true);
      for (const child of children)
        expect(positions.get(sourceId(child))).toEqual({
          x: child.frame.x,
          y: child.frame.y,
        });
      expect(
        [...node.children]
          .reverse()
          .map((child: any) => child.getPluginData("sketch2figma:sourceId")),
      ).toEqual(source.layers.map(sourceId));
    },
  );
  it("preserves an independent cross-axis offset that cannot share an alignment", () => {
    const source = group([
      rectangle("A", 10, 10, 30, 20),
      rectangle("B", 70, 60, 20, 20),
    ]);
    expect(smartLayoutPlan(source)).toHaveProperty("reason");
  });
  it("does not reorder arbitrary source paint order to force a linear layout", () => {
    const source = group([
      rectangle("B", 10, 60, 30, 20),
      rectangle("A", 10, 10, 30, 20),
      rectangle("C", 10, 110, 30, 20),
    ]);
    expect(smartLayoutPlan(source)).toHaveProperty("reason");
  });
  it("does not propagate an intrinsic native size difference through otherwise linear source positions", async () => {
    const source = group([
      rectangle("A", 10, 20, 80, 30),
      rectangle("B", 10, 70, 80, 30),
    ]);
    const file = archive(source),
      host = createHost();
    const create = host.api.createRectangle.bind(host.api);
    host.api.createRectangle = (() => {
      const node = create(),
        resize = node.resize.bind(node);
      node.resize = (width, height) => resize(width, height + 1);
      return node;
    }) as typeof host.api.createRectangle;
    await startImport(host.api, file, options).result;
    expect(target(host, file, "GROUP").layoutMode).toBe("NONE");
    expect(target(host, file, "B").y).toBe(70);
  });
  it.each(["rotation", "isFlippedHorizontal", "isFlippedVertical"])(
    "retains transformed child geometry (%s)",
    (field) => {
      const child = rectangle("A", 20, 20, 30, 20);
      child[field] = field === "rotation" ? 30 : true;
      expect(smartLayoutPlan(group([child]))).toHaveProperty("reason");
    },
  );
  it("keeps overflowing children editable in their original positions", async () => {
    const file = archive(group([rectangle("A", -20, 10, 80, 30)])),
      host = createHost();
    await startImport(host.api, file, options).result;
    expect(target(host, file, "GROUP").layoutMode).toBe("NONE");
    expect(target(host, file, "A").x).toBe(-20);
  });
  it("recovers a partial native layout rejection without leaving children in flow", async () => {
    const source = group([rectangle("A", 20, 10, 80, 30)]),
      file = archive(source),
      host = createHost();
    const create = host.api.createFrame.bind(host.api);
    host.api.createFrame = (() => {
      const node = create();
      Object.defineProperty(node, "counterAxisAlignItems", {
        get: () => "MIN",
        set: () => {
          throw Error("Rejected layout property");
        },
      });
      return node;
    }) as typeof host.api.createFrame;
    const result = await startImport(host.api, file, options).result;
    expect(result.state).toBe("complete");
    expect(target(host, file, "GROUP").layoutMode).toBe("NONE");
    expect([target(host, file, "A").x, target(host, file, "A").y]).toEqual([
      20, 10,
    ]);
    expect(
      result.findings.some((finding) => finding.code === "API_REJECTED"),
    ).toBe(true);
  });
  it("restores source paint order if a native rejection occurs after flow reordering", async () => {
    const source = group([
      rectangle("B", 20, 80, 80, 30),
      rectangle("A", 20, 10, 80, 30),
    ]);
    const file = archive(source),
      host = createHost();
    const create = host.api.createFrame.bind(host.api);
    host.api.createFrame = (() => {
      const node = create();
      const resize = node.resize.bind(node);
      node.resize = (width, height) => {
        if (node.layoutMode !== "NONE") throw Error("Rejected final resize");
        resize(width, height);
      };
      return node;
    }) as typeof host.api.createFrame;
    const result = await startImport(host.api, file, options).result;
    const parent = target(host, file, "GROUP");
    expect(result.state).toBe("complete");
    expect(parent.layoutMode).toBe("NONE");
    expect(
      parent.children.map((child: SceneNode) =>
        child.getPluginData("sketch2figma:sourceId"),
      ),
    ).toEqual(["B", "A"]);
    expect(target(host, file, "A").y).toBe(10);
    expect(target(host, file, "B").y).toBe(80);
    expect(
      result.findings.some((finding) => finding.code === "API_REJECTED"),
    ).toBe(true);
  });
  it("repairs an unchanged revision-10 import without duplicating nodes or treating it as a user edit", async () => {
    const source = group([
      rectangle("BG", 0, 0, 300, 240),
      rectangle("TEXT", 80, 60, 140, 40),
    ]);
    const file = archive(source),
      host = createHost();
    await startImport(host.api, file, options).result;
    const index = readIndex(host.api, file.documentId),
      parent = target(host, file, "GROUP");
    parent.layoutMode = "VERTICAL";
    target(host, file, "TEXT").x = 0;
    target(host, file, "TEXT").y = 300;
    for (const child of walkLayers(file.pages).filter(
      (child) => child._class !== "page",
    )) {
      index.nodes[sourceId(child)] = await mapping(
        target(host, file, sourceId(child)),
        child,
        "revision-10",
      );
    }
    writeData(host.api.root, `index:${file.documentId}`, index);
    const before = host.nodes.size;
    const result = await startImport(host.api, file, options).result;
    expect(result.created).toBe(0);
    expect(result.preserved).toBe(0);
    expect(host.nodes.size).toBe(before);
    expect(parent.layoutMode).toBe("NONE");
    expect([
      target(host, file, "TEXT").x,
      target(host, file, "TEXT").y,
    ]).toEqual([80, 60]);
  });
});
