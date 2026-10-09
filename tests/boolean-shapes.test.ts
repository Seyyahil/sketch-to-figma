import { describe, expect, it, vi } from "vitest";
import { startImport } from "../src/figma/importer";
import { validateBooleanShape } from "../src/figma/booleans";
import { ImportContext } from "../src/figma/context";
import {
  capture,
  readIndex,
  targetFingerprint,
  writeIndex,
} from "../src/figma/storage";
import {
  DEFAULT_OPTIONS,
  type Sketch,
  type SketchFile,
} from "../src/core/types";
import {
  filledPath,
  joinContours,
  mapNetwork,
  sourceContours,
} from "../src/core/compound-paths";
import { createHost } from "./mock-figma";
import { networkBounds } from "../src/figma/geometry-validation";

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  op: number,
  reverse = false,
): Sketch {
  const points = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  if (reverse) points.reverse();
  return {
    _class: "shapePath",
    do_objectID: id,
    name: id,
    booleanOperation: op,
    isClosed: true,
    isVisible: true,
    frame: { x, y, width: w, height: h },
    style: { fills: [], borders: [] },
    points: points.map(([x, y]) => ({
      point: `{${x}, ${y}}`,
      hasCurveFrom: false,
      hasCurveTo: false,
      cornerRadius: 0,
    })),
  };
}
function file(ops = [-1, -1], rule = 1, reverse = false): SketchFile {
  return {
    name: "boolean-unit.sketch",
    documentId: "BOOLEAN",
    version: 196,
    digest: "boolean-unit",
    assets: [],
    warnings: [],
    document: { colorSpace: 1 },
    meta: { version: 196 },
    user: {},
    pages: [
      {
        _class: "page",
        do_objectID: "P",
        name: "P",
        layers: [
          {
            _class: "shapeGroup",
            do_objectID: "G",
            name: "Shape",
            frame: { x: 0, y: 0, width: 100, height: 100 },
            style: {
              windingRule: rule,
              fills: [
                {
                  fillType: 0,
                  isEnabled: true,
                  color: { red: 1, green: 0, blue: 0, alpha: 1 },
                },
              ],
            },
            layers: [
              rect("A", 0, 0, 100, 100, ops[0]),
              rect("B", 20, 20, 60, 60, ops[1], reverse),
              ...(ops.length > 2 ? [rect("C", 40, 40, 20, 20, ops[2])] : []),
            ],
          },
        ],
      },
    ],
  };
}
const source = (f: SketchFile) => f.pages[0].layers[0];
const owner = (h: ReturnType<typeof createHost>) =>
  h.nodes.get(readIndex(h.api, "BOOLEAN").nodes.G.nodeId);
const render = (n: any) =>
  n.children.find(
    (c: any) => c.getPluginData("sketch2figma:wrapper") === "boolean",
  );
function inverse(t: number[][], x: number, y: number): [number, number] {
  const d = t[0][0] * t[1][1] - t[0][1] * t[1][0];
  x -= t[0][2];
  y -= t[1][2];
  return [(t[1][1] * x - t[0][1] * y) / d, (-t[1][0] * x + t[0][0] * y) / d];
}
// Independent filled-area oracle for straight-edge test cases. This is not a
// Figma renderer and does not certify curves, text outlines, strokes or effects.
function contains(n: any, x: number, y: number): boolean {
  if (n.visible === false) return false;
  [x, y] = inverse(n.relativeTransform, x, y);
  if (n.type === "BOOLEAN_OPERATION") {
    const values = n.children.map((c: any) => contains(c, x, y));
    if (n.booleanOperation === "UNION") return values.some(Boolean);
    if (n.booleanOperation === "SUBTRACT")
      return values[0] && !values.slice(1).some(Boolean);
    if (n.booleanOperation === "INTERSECT") return values.every(Boolean);
    return values.filter(Boolean).length % 2 === 1;
  }
  if (n.type !== "VECTOR")
    return n.children?.some((c: any) => contains(c, x, y)) ?? false;
  const network: VectorNetwork = n.vectorNetwork;
  return (network.regions ?? []).some((r) => {
    let winding = 0;
    for (const loop of r.loops)
      for (const i of loop) {
        const e = network.segments[i],
          a = network.vertices[e.start],
          b = network.vertices[e.end];
        const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
        if (a.y <= y && b.y > y && side > 0) winding++;
        else if (a.y > y && b.y <= y && side < 0) winding--;
      }
    return r.windingRule === "EVENODD"
      ? Math.abs(winding) % 2 === 1
      : winding !== 0;
  });
}
describe("shared shape operations", () => {
  it.each([
    [1, false],
    [0, true],
  ])(
    "honors fill rule %s for same-winding nested contours",
    async (rule, center) => {
      const h = createHost(),
        r = await startImport(h.api, file([-1, -1], rule), DEFAULT_OPTIONS)
          .result;
      expect(r.state).toBe("complete");
      const n = owner(h),
        result = render(n);
      expect(result.type).toBe("VECTOR");
      expect(contains(n, 10, 10)).toBe(true);
      expect(contains(n, 50, 50)).toBe(center);
      expect(result.vectorNetwork.regions).toHaveLength(1);
      expect(result.vectorNetwork.regions[0].loops).toHaveLength(2);
      for (const id of ["A", "B"]) {
        const original = h.nodes.get(
          readIndex(h.api, "BOOLEAN").nodes[id].nodeId,
        );
        expect(original.name).toBe(id);
        expect(original.parent.visible).toBe(false);
        expect(original.visible).toBe(true);
      }
      expect(
        r.validations
          .filter((c) => c.kind === "boolean-geometry")
          .map((c) => c.passed),
      ).toEqual([true]);
      expect(r.findings.some((f) => f.code === "COMPOUND_EDITABILITY")).toBe(
        true,
      );
    },
  );
  it("retains opposite-winding holes under Nonzero", async () => {
    const h = createHost();
    await startImport(h.api, file([-1, -1], 0, true), DEFAULT_OPTIONS).result;
    expect(contains(owner(h), 50, 50)).toBe(false);
    expect(contains(owner(h), 10, 10)).toBe(true);
  });
  it.each([
    [0, "UNION", true, true],
    [1, "SUBTRACT", true, false],
    [2, "INTERSECT", false, true],
    [3, "EXCLUDE", true, false],
  ])(
    "uses native operation %s in source order",
    async (op, name, outer, center) => {
      const h = createHost(),
        r = await startImport(h.api, file([0, op]), DEFAULT_OPTIONS).result;
      expect(r.state).toBe("complete");
      expect(render(owner(h)).booleanOperation).toBe(name);
      expect(contains(owner(h), 10, 10)).toBe(outer);
      expect(contains(owner(h), 50, 50)).toBe(center);
      expect(
        r.validations.find((v) => v.kind === "boolean-geometry")?.passed,
      ).toBe(true);
    },
  );
  it("supplies operative geometry for unpainted native boolean operands without creating styles or variables", async () => {
    const h = createHost(),
      subtract = h.api.subtract;
    h.api.subtract = (nodes, parent, index) => {
      for (const node of nodes as SceneNode[]) {
        expect(
          "fills" in node &&
            typeof node.fills !== "symbol" &&
            node.fills.some((p) => p.visible !== false),
        ).toBe(true);
      }
      return subtract(nodes, parent, index);
    };
    const r = await startImport(h.api, file([0, 1]), DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(
      r.findings.filter((f) => f.code === "BOOLEAN_GEOMETRY_FILL"),
    ).toHaveLength(2);
    expect(h.styles.size).toBe(0);
    expect(h.variables.size).toBe(0);
  });
  it("uses native editable operands for nested combined shapes and retains their original subtrees across reimport", async () => {
    const f = file([0, 1]),
      inner = structuredClone(source(f));
    inner.do_objectID = "INNER";
    inner.name = "Nested shape";
    inner.layers.forEach((n: Sketch) => (n.do_objectID += "-inner"));
    inner.layers[0].booleanOperation = inner.layers[1].booleanOperation = -1;
    source(f).layers[0] = inner;
    const h = createHost(),
      subtract = h.api.subtract;
    h.api.subtract = (nodes, parent, index) => {
      expect(nodes.every((n) => n.type !== "FRAME")).toBe(true);
      return subtract(nodes, parent, index);
    };
    const first = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(first.state).toBe("complete");
    expect(
      first.validations.filter(
        (v) => v.kind === "boolean-geometry" && v.passed !== true,
      ),
    ).toEqual([]);
    expect(contains(owner(h), 10, 10)).toBe(true);
    expect(contains(owner(h), 50, 50)).toBe(false);
    const id = readIndex(h.api, "BOOLEAN").nodes.INNER.nodeId,
      count = h.nodes.size;
    const again = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(again.state).toBe("complete");
    expect(h.nodes.size).toBe(count);
    expect(readIndex(h.api, "BOOLEAN").nodes.INNER.nodeId).toBe(id);
    inner.layers[0].frame.width = 95;
    const changed = await startImport(h.api, f, {
      ...DEFAULT_OPTIONS,
      conflict: "replace-imported",
    }).result;
    expect(changed.state).toBe("complete");
    expect(readIndex(h.api, "BOOLEAN").nodes.INNER.nodeId).toBe(id);
    expect(h.nodes.size).toBe(count);
    expect(
      changed.validations.filter(
        (v) => v.kind === "hierarchy" && v.passed === false,
      ),
    ).toEqual([]);
  });
  it.each([0, 1])(
    "matches Sketch's parity clipping for a self-overlapping boolean operand under group fill rule %s",
    async (rule) => {
      const f = file([0, 1], rule),
        a = source(f).layers[0];
      a.points = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8],
        [0.2, 0.2],
        [0, 0],
      ].map(([x, y]) => ({
        point: `{${x}, ${y}}`,
        hasCurveFrom: false,
        hasCurveTo: false,
        cornerRadius: 0,
      }));
      a.style.windingRule = 0;
      source(f).layers[1].frame = { x: 110, y: 0, width: 10, height: 10 };
      const h = createHost(),
        r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
      expect(r.state).toBe("complete");
      expect(contains(owner(h), 10, 90)).toBe(true);
      expect(contains(owner(h), 50, 50)).toBe(false);
      expect(r.findings.some((f) => f.code === "BOOLEAN_OPERAND_WINDING")).toBe(
        true,
      );
    },
  );
  it("retains Nonzero holes while allowing equivalent globally reversed native loop traversal", async () => {
    const h = createHost(),
      f = file([-1, -1], 0, true);
    await startImport(h.api, f, DEFAULT_OPTIONS).result;
    const n = render(owner(h)),
      network = structuredClone(n.vectorNetwork),
      report: any = { validations: [], findings: [] };
    const ctx = new ImportContext(
      h.api,
      f,
      DEFAULT_OPTIONS,
      report,
      readIndex(h.api, "BOOLEAN"),
      { track() {}, trackResource() {}, async before() {} },
      () => {},
    );
    network.regions[0].loops = network.regions[0].loops.map((l: number[]) =>
      [...l].reverse(),
    );
    await n.setVectorNetworkAsync(network);
    validateBooleanShape(ctx, source(f), owner(h));
    expect(report.validations.at(-1).passed).toBe(true);
    network.regions[0].loops[1].reverse();
    await n.setVectorNetworkAsync(network);
    validateBooleanShape(ctx, source(f), owner(h));
    expect(report.validations.at(-1).passed).toBe(false);
  });
  it("resolves a Frame operand through a disposable copy and retains its original editable layers", async () => {
    const f = file([0, 1]),
      original = source(f).layers[0];
    source(f).layers[0] = {
      ...original,
      _class: "frame",
      points: undefined,
      layers: [
        {
          ...rect("FRAME-CHILD", 0, 0, 100, 100, 0),
          _class: "rectangle",
          style: {
            fills: [
              { fillType: 0, color: { red: 1, green: 0, blue: 0, alpha: 1 } },
            ],
          },
        },
      ],
    };
    const h = createHost(),
      flatten = vi.spyOn(h.api, "flatten"),
      r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    const index = readIndex(h.api, "BOOLEAN"),
      frame = h.nodes.get(index.nodes.A.nodeId);
    expect(frame.type).toBe("FRAME");
    expect(
      frame.findAll(
        (n: any) => n.getPluginData("sketch2figma:sourceId") === "FRAME-CHILD",
      ),
    ).toHaveLength(1);
    expect(flatten.mock.calls[0][0][0].id).not.toBe(frame.id);
    expect(
      r.validations.find((v) => v.kind === "boolean-geometry")?.passed,
    ).toBe(true);
  });
  it.each([
    [0, true],
    [1, false],
  ])(
    "retains parent fill rule %s on a lone explicit self-overlapping operand",
    async (rule, center) => {
      const f = file([0, 0], Number(rule));
      source(f).layers.pop();
      source(f).layers[0].points = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8],
        [0.2, 0.2],
        [0, 0],
      ].map(([x, y]) => ({
        point: `{${x}, ${y}}`,
        hasCurveFrom: false,
        hasCurveTo: false,
        cornerRadius: 0,
      }));
      const h = createHost(),
        r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
      expect(r.state).toBe("complete");
      expect(render(owner(h)).type).toBe("VECTOR");
      expect(contains(owner(h), 50, 50)).toBe(center);
      expect(
        r.validations.find((v) => v.kind === "boolean-geometry")?.passed,
      ).toBe(true);
    },
  );
  it("retains disabled source paints and their variable links when an operative fill is required", async () => {
    const f = file([0, 1]);
    f.document.sharedSwatches = {
      objects: [
        {
          do_objectID: "C",
          name: "Source Blue",
          value: { red: 0, green: 0, blue: 1, alpha: 1 },
        },
      ],
    };
    source(f).layers[0].style.fills = [
      {
        fillType: 0,
        isEnabled: false,
        color: { red: 0, green: 0, blue: 1, alpha: 1, swatchID: "C" },
      },
    ];
    const h = createHost(),
      r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    const a = h.nodes.get(readIndex(h.api, "BOOLEAN").nodes.A.nodeId);
    expect(a.fills[0].visible).toBe(false);
    expect(a.fills[0].boundVariables.color.id).toBe(
      [...h.variables.values()][0].id,
    );
    expect(
      r.validations
        .filter((v) => v.kind === "variable-binding")
        .map((v) => v.passed),
    ).toEqual([true]);
    expect([...h.variables.values()].map((v) => v.name)).toEqual([
      "Source Blue",
    ]);
    expect(h.styles.size).toBe(0);
    expect(contains(owner(h), 10, 10)).toBe(true);
    expect(contains(owner(h), 50, 50)).toBe(false);
  });
  it("matches Sketch CLI's mixed Subtract/None/Evenodd island", async () => {
    // Native Sketch export: outer rectangle, reversed hole, positive island.
    const h = createHost(),
      r = await startImport(h.api, file([0, 1, -1]), DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(contains(owner(h), 10, 10)).toBe(true);
    expect(contains(owner(h), 30, 30)).toBe(false);
    expect(contains(owner(h), 50, 50)).toBe(true);
    expect(render(owner(h)).booleanOperation).toBe("EXCLUDE");
  });
  it("preserves a compound prefix before a subsequent Subtract", async () => {
    const h = createHost(),
      r = await startImport(h.api, file([-1, -1, 1]), DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(contains(owner(h), 50, 50)).toBe(false);
    expect(contains(owner(h), 10, 10)).toBe(true);
  });
  it("imports all compound operands and required resources when only a contour is selected", async () => {
    const h = createHost(),
      f = file();
    source(f).layers[1].style.fills = [
      {
        fillType: 0,
        color: { red: 1, green: 0, blue: 0, alpha: 1, swatchID: "COLOR" },
      },
    ];
    f.document.sharedSwatches = {
      objects: [
        {
          do_objectID: "COLOR",
          name: "Source color",
          value: { red: 1, green: 0, blue: 0, alpha: 1 },
        },
      ],
    };
    const r = await startImport(h.api, f, {
      ...DEFAULT_OPTIONS,
      selectedIds: ["A"],
      resources: false,
    }).result;
    expect(r.state).toBe("complete");
    expect(readIndex(h.api, "BOOLEAN").nodes.B).toBeDefined();
    expect([...h.variables.values()].map((v) => v.name)).toContain(
      "Source color",
    );
    expect(contains(owner(h), 50, 50)).toBe(false);
  });
  it("preserves a lone explicit operand's source fill rule and name", async () => {
    const h = createHost(),
      f = file([0, 0]);
    source(f).layers.pop();
    const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(
      r.validations.find((v) => v.kind === "boolean-geometry")?.passed,
    ).toBe(true);
    expect(h.nodes.get(readIndex(h.api, "BOOLEAN").nodes.A.nodeId).name).toBe(
      "A",
    );
  });
  it("ignores native float rounding, cyclic starts and reversed stored segment directions without hiding real contour changes", async () => {
    const h = createHost(),
      f = file();
    source(f).layers[1].frame.x = 20.1234567;
    await startImport(h.api, f, DEFAULT_OPTIONS).result;
    const n = render(owner(h)),
      network = structuredClone(n.vectorNetwork);
    network.vertices = network.vertices.map((v: any) => ({
      ...v,
      x: Math.fround(v.x),
      y: Math.fround(v.y),
    }));
    network.segments = network.segments.map((e: any) => ({
      ...e,
      start: e.end,
      end: e.start,
      tangentStart: e.tangentEnd,
      tangentEnd: e.tangentStart,
    }));
    network.regions[0].loops = network.regions[0].loops
      .reverse()
      .map((loop: number[]) => [...loop.slice(2), ...loop.slice(0, 2)]);
    await n.setVectorNetworkAsync(network);
    const report: any = { validations: [], findings: [] };
    const ctx = new ImportContext(
      h.api,
      f,
      DEFAULT_OPTIONS,
      report,
      readIndex(h.api, "BOOLEAN"),
      { track() {}, trackResource() {}, async before() {} },
      () => {},
    );
    validateBooleanShape(ctx, source(f), owner(h));
    expect(report.validations.at(-1).passed).toBe(true);
    network.vertices[0].x += 0.2;
    await n.setVectorNetworkAsync(network);
    validateBooleanShape(ctx, source(f), owner(h));
    expect(report.validations.at(-1).passed).toBe(false);
  });
  it("does not let hidden operands subtract visible geometry", async () => {
    const f = file([0, 1]);
    source(f).layers[1].isVisible = false;
    const h = createHost();
    const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(contains(owner(h), 50, 50)).toBe(true);
    expect(
      h.nodes.get(readIndex(h.api, "BOOLEAN").nodes.B.nodeId).visible,
    ).toBe(false);
  });
  it("preserves affine contour geometry including rotation and reflection", () => {
    const shape = rect("R", 10, 20, 40, 20, -1);
    shape.rotation = 90;
    shape.isFlippedHorizontal = true;
    const n = sourceContours(shape, "EVENODD");
    expect(n.vertices[0].x).toBeCloseTo(20);
    expect(n.vertices[0].y).toBeCloseTo(10);
    expect(n.segments.map((e) => [e.start, e.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ]);
  });
  it("welds repeated endpoints on serialized-open contours without losing closing Bézier handles", () => {
    const s = rect("R", 0, 0, 100, 100, -1);
    s.isClosed = false;
    s.points.push({ ...s.points[0], hasCurveTo: true, curveTo: "{0.2, 0.1}" });
    const n = filledPath(s, "EVENODD");
    expect(n.vertices).toHaveLength(4);
    expect(n.segments).toHaveLength(4);
    expect(n.segments[3].end).toBe(0);
    expect(n.segments[3].tangentEnd).toEqual({ x: 20, y: 10 });
  });
  it("preserves editable Bézier control points and loop boundaries in a compound", () => {
    const s = rect("R", 0, 0, 100, 100, -1);
    s.points[0].hasCurveFrom = true;
    s.points[0].curveFrom = "{0.1, 0.2}";
    const n = joinContours(
      [
        filledPath(s, "NONZERO"),
        filledPath(rect("B", 0, 0, 20, 20, -1), "NONZERO"),
      ],
      "NONZERO",
    );
    expect(n.segments[0].tangentStart).toEqual({ x: 10, y: 20 });
    expect(n.regions?.[0].loops).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });
  it("honors nested pure compounds without dropping their source hierarchy", async () => {
    const f = file(),
      inner = structuredClone(source(f));
    inner.do_objectID = "INNER";
    inner.name = "Inner";
    inner.layers.forEach((n: Sketch) => (n.do_objectID += "-inner"));
    source(f).layers = [inner, rect("R", 110, 0, 10, 10, -1)];
    const h = createHost(),
      r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(contains(owner(h), 50, 50)).toBe(false);
    expect(contains(owner(h), 115, 5)).toBe(true);
    expect(
      r.validations
        .filter((c) => c.kind === "hierarchy")
        .every((c) => c.passed),
    ).toBe(true);
  });
  it("reimports changed compound contours without duplicate wrappers or mistaken local conflicts", async () => {
    const h = createHost(),
      f = file();
    await startImport(h.api, f, DEFAULT_OPTIONS).result;
    const old = readIndex(h.api, "BOOLEAN"),
      ids = Object.fromEntries(
        Object.entries(old.nodes).map(([k, v]) => [k, v.nodeId]),
      );
    source(f).layers[1].frame.x = 30;
    const updated = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(updated.state).toBe("complete");
    expect(
      owner(h).children.filter(
        (n: any) => n.getPluginData("sketch2figma:wrapper") === "boolean",
      ),
    ).toHaveLength(1);
    expect(
      owner(h).children.filter(
        (n: any) =>
          n.getPluginData("sketch2figma:wrapper") === "compound-sources",
      ),
    ).toHaveLength(1);
    const count = h.nodes.size;
    const second = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(second.preserved).toBe(0);
    expect(second.created).toBe(0);
    expect(h.nodes.size).toBe(count);
    for (const [id, nodeId] of Object.entries(ids))
      expect(readIndex(h.api, "BOOLEAN").nodes[id].nodeId).toBe(nodeId);
  });
  it("detects local boolean-operation and compound-network edits", async () => {
    const h = createHost();
    await startImport(h.api, file([0, 1]), DEFAULT_OPTIONS).result;
    const node = owner(h),
      before = await targetFingerprint(node);
    render(node).booleanOperation = "UNION";
    expect(await targetFingerprint(node)).not.toBe(before);
    const h2 = createHost();
    await startImport(h2.api, file(), DEFAULT_OPTIONS).result;
    const n = owner(h2),
      fingerprint = await targetFingerprint(n);
    render(n).vectorNetwork.regions[0].windingRule = "NONZERO";
    expect(await targetFingerprint(n)).not.toBe(fingerprint);
  });
  it("rolls back existing source nodes, networks and wrappers after an API failure", async () => {
    const h = createHost(),
      f = file();
    await startImport(h.api, f, DEFAULT_OPTIONS).result;
    const n = owner(h),
      snapshot = capture(n, true),
      index = readIndex(h.api, "BOOLEAN"),
      count = h.nodes.size;
    const create = h.api.createVector;
    h.api.createVector = () => {
      const vector = create();
      vector.setVectorNetworkAsync = async () => {
        throw new Error("Injected compound API failure");
      };
      return vector;
    };
    source(f).layers[0].points[0].point = "{0.1, 0}";
    const result = await startImport(h.api, f, {
      ...DEFAULT_OPTIONS,
      conflict: "replace-imported",
    }).result;
    expect(result.state).toBe("failed");
    expect(result.findings.some((f) => f.code === "RECOVERY_FAILURE")).toBe(
      false,
    );
    expect(capture(n, true)).toEqual(snapshot);
    expect(readIndex(h.api, "BOOLEAN")).toEqual(index);
    expect(h.nodes.size).toBe(count);
  });
  it.each([99, "bad"])(
    "rejects unknown operations %s and rolls back instead of assuming Union",
    async (op) => {
      const h = createHost(),
        f = file();
      source(f).layers[1].booleanOperation = op;
      const count = h.nodes.size;
      const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
      expect(r.state).toBe("failed");
      expect(r.findings.some((f) => f.code === "BOOLEAN_CONVERSION")).toBe(
        true,
      );
      expect(h.nodes.size).toBe(count);
    },
  );
  it("detects a wrong Union renderer in structural readback", async () => {
    const h = createHost(),
      f = file();
    await startImport(h.api, f, DEFAULT_OPTIONS).result;
    const n = owner(h);
    render(n).type = "BOOLEAN_OPERATION";
    render(n).booleanOperation = "UNION";
    const report: any = { validations: [], findings: [] };
    const ctx = new ImportContext(
      h.api,
      f,
      DEFAULT_OPTIONS,
      report,
      readIndex(h.api, "BOOLEAN"),
      { track() {}, trackResource() {}, async before() {} },
      () => {},
    );
    validateBooleanShape(ctx, source(f), n);
    expect(report.validations[0].passed).toBe(false);
  });
  it("resolves only disposable copies when outlining a source text operand", async () => {
    const f = file();
    source(f).layers[1] = {
      _class: "text",
      do_objectID: "T",
      name: "Source text",
      booleanOperation: -1,
      frame: { x: 20, y: 20, width: 20, height: 20 },
      attributedString: { string: "A", attributes: [] },
      style: {
        textStyle: {
          encodedAttributes: {
            MSAttributedStringFontAttribute: {
              attributes: { name: "Inter-Regular", size: 14 },
            },
          },
        },
      },
    };
    const h = createHost(),
      flatten = vi.spyOn(h.api, "flatten"),
      r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    const original = h.nodes.get(readIndex(h.api, "BOOLEAN").nodes.T.nodeId);
    expect(original.type).toBe("TEXT");
    expect(original.characters).toBe("A");
    expect(original.name).toBe("Source text");
    expect(original.removed).toBe(false);
    expect(flatten.mock.calls[0][0][0].id).not.toBe(original.id);
  });
});

it("upgrades legacy Union-for-None imports under preserve-local without false conflicts", async () => {
  const h = createHost(),
    f = file();
  await startImport(h.api, f, DEFAULT_OPTIONS).result;
  const parent = owner(h),
    index = readIndex(h.api, "BOOLEAN"),
    renderer = render(parent);
  const originals = ["A", "B"].map((id) => h.nodes.get(index.nodes[id].nodeId));
  const oldBoolean = h.api.union(originals, parent);
  oldBoolean.name = "Boolean / Shape";
  oldBoolean.setPluginData("sketch2figma:wrapper", "boolean");
  oldBoolean.setPluginData("sketch2figma:documentId", "BOOLEAN");
  renderer.remove();
  for (const n of [...parent.children])
    if (n.getPluginData("sketch2figma:wrapper") === "compound-sources")
      n.remove();
  for (const entry of Object.values(index.nodes)) {
    entry.targetHash = await targetFingerprint(h.nodes.get(entry.nodeId), 1);
    delete entry.targetHashVersion;
    entry.conversionHash = "legacy-revision-9";
  }
  writeIndex(h.api, index);
  const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
  expect(r.state).toBe("complete");
  expect(r.preserved).toBe(0);
  expect(render(parent).type).toBe("VECTOR");
  expect(oldBoolean.removed).toBe(true);
  expect(contains(parent, 50, 50)).toBe(false);
  const repeat = await startImport(h.api, f, DEFAULT_OPTIONS).result;
  expect(repeat.preserved).toBe(0);
  expect(repeat.created).toBe(0);
});
it("preserves real local edits while migrating legacy fingerprint records", async () => {
  const h = createHost(),
    f = file();
  await startImport(h.api, f, DEFAULT_OPTIONS).result;
  const index = readIndex(h.api, "BOOLEAN");
  for (const entry of Object.values(index.nodes)) {
    entry.targetHash = await targetFingerprint(h.nodes.get(entry.nodeId), 1);
    delete entry.targetHashVersion;
    entry.conversionHash = "legacy-revision-9";
  }
  writeIndex(h.api, index);
  owner(h).name = "Local shape name";
  const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
  expect(r.preserved).toBeGreaterThan(0);
  expect(owner(h).name).toBe("Local shape name");
});
it("rolls back a cancelled reimport after new compound wrappers exist", async () => {
  const h = createHost(),
    f = file();
  f.pages[0].layers.push(rect("D", 200, 0, 10, 10, 0));
  await startImport(h.api, f, DEFAULT_OPTIONS).result;
  const before = capture(owner(h), true),
    index = readIndex(h.api, "BOOLEAN"),
    count = h.nodes.size;
  source(f).layers[1].frame.x = 30;
  let run: ReturnType<typeof startImport>;
  run = startImport(h.api, f, DEFAULT_OPTIONS, [], (_, name) => {
    if (name === "D") run.cancel();
  });
  const r = await run.result;
  expect(r.state).toBe("cancelled");
  expect(r.findings.some((f) => f.code === "RECOVERY_FAILURE")).toBe(false);
  expect(capture(owner(h), true)).toEqual(before);
  expect(readIndex(h.api, "BOOLEAN")).toEqual(index);
  expect(h.nodes.size).toBe(count);
});
it.each([
  [1, false],
  [0, true],
])(
  "retains self-overlap winding semantics for rule %s",
  async (rule, filled) => {
    const h = createHost(),
      f = file([-1], rule);
    source(f).layers = source(f).layers.slice(0, 1);
    const path = source(f).layers[0];
    path.points = [...path.points, ...structuredClone(path.points)];
    const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
    expect(r.state).toBe("complete");
    expect(contains(owner(h), 50, 50)).toBe(filled);
  },
);

it("preserves rollback when the host automatically removes emptied boolean containers", async () => {
  const h = createHost(),
    f = file([0, 1]);
  await startImport(h.api, f, DEFAULT_OPTIONS).result;
  const parent = owner(h),
    before = capture(parent, true),
    count = h.nodes.size;
  const prototype = Object.getPrototypeOf(parent),
    insert = prototype.insertChild;
  prototype.insertChild = function (i: number, node: any) {
    const old = node.parent;
    insert.call(this, i, node);
    if (
      old !== this &&
      old?.type === "BOOLEAN_OPERATION" &&
      old.children.length === 0
    )
      old.remove();
  };
  const subtract = h.api.subtract;
  h.api.subtract = () => {
    throw new Error("Injected boolean rejection");
  };
  source(f).layers[1].frame.x = 30;
  try {
    const r = await startImport(h.api, f, {
      ...DEFAULT_OPTIONS,
      conflict: "replace-imported",
    }).result;
    expect(r.state).toBe("failed");
    expect(r.findings.some((f) => f.code === "RECOVERY_FAILURE")).toBe(false);
    expect(capture(parent, true)).toEqual(before);
    expect(h.nodes.size).toBe(count);
  } finally {
    prototype.insertChild = insert;
    h.api.subtract = subtract;
  }
});
it("keeps unchanged operands in source coordinates when rebuilding an offset native boolean", async () => {
  const h = createHost(),
    f = file([0, 1]);
  source(f).layers[0].frame.x = 10;
  source(f).layers[1].frame.x = 30;
  await startImport(h.api, f, DEFAULT_OPTIONS).result;
  const index = readIndex(h.api, "BOOLEAN"),
    a = h.nodes.get(index.nodes.A.nodeId);
  source(f).layers[1].frame.x = 40;
  const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
  expect(r.state).toBe("complete");
  expect(contains(owner(h), 15, 10)).toBe(true);
  expect(contains(owner(h), 50, 50)).toBe(false);
  expect(
    r.validations.find((v) => v.kind === "transform" && v.sourceId === "A")
      ?.passed,
  ).toBe(true);
  expect(a.name).toBe("A");
});

it("preserves gradient coordinates when boolean geometry occupies only part of the source frame", async () => {
  const h = createHost(),
    f = file();
  source(f).layers[0].frame = { x: 10, y: 10, width: 80, height: 80 };
  source(f).style.fills = [
    {
      fillType: 1,
      gradient: {
        gradientType: 0,
        from: "{0, 0}",
        to: "{1, 0}",
        stops: [
          { position: 0, color: { red: 0, green: 0, blue: 0, alpha: 1 } },
          { position: 1, color: { red: 1, green: 1, blue: 1, alpha: 1 } },
        ],
      },
    },
  ];
  const create = h.api.createVector;
  h.api.createVector = () => {
    const n = create(),
      set = n.setVectorNetworkAsync.bind(n);
    n.setVectorNetworkAsync = async (network: any) => {
      await set(network);
      const b = networkBounds(network);
      n.resize(Math.max(0.01, b.width), Math.max(0.01, b.height));
    };
    return n;
  };
  const r = await startImport(h.api, f, DEFAULT_OPTIONS).result;
  expect(r.state).toBe("complete");
  const gradient = render(owner(h)).fills[0];
  expect(gradient.type).toBe("GRADIENT_LINEAR");
  expect(gradient.gradientTransform).toEqual([
    [0.8, 0, 0.1],
    [0, 0.8, 0.6],
  ]);
});
