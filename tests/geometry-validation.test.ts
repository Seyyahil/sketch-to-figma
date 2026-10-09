import { describe, expect, it } from "vitest";
import {
  auditGeometry,
  multiplyTransforms,
  networkBounds,
  sourceRelativeTransform,
} from "../src/figma/geometry-validation";
import { transform, vectorNetwork } from "../src/core/math";
import { type Sketch } from "../src/core/types";

const line = (): Sketch => ({
  _class: "shapePath",
  do_objectID: "LINE",
  name: "Line",
  frame: { x: 15, y: 61, width: 345, height: 2 },
  points: [{ point: "{0, 0.5}" }, { point: "{1, 0.5}" }],
});
const rect = (): Sketch => ({
  _class: "rectangle",
  do_objectID: "R",
  name: "Rectangle",
  frame: { x: 10, y: 20, width: 100, height: 50 },
});
const frameTarget = (s: Sketch) => ({
  type: "RECTANGLE" as const,
  width: s.frame.width,
  height: s.frame.height,
  relativeTransform: transform(s),
});
// Model only origin rebasing. This is a math regression, not a native Figma render.
function rebased(s: Sketch) {
  const network = vectorNetwork(s),
    bounds = networkBounds(network);
  return {
    type: "VECTOR" as const,
    width: bounds.width,
    height: bounds.height,
    relativeTransform: multiplyTransforms(transform(s), [
      [1, 0, bounds.x],
      [0, 1, bounds.y],
    ]),
    vectorNetwork: {
      ...network,
      vertices: network.vertices.map((v) => ({
        ...v,
        x: v.x - bounds.x,
        y: v.y - bounds.y,
      })),
    },
  };
}
describe("geometry comparison bases", () => {
  it("accepts Line 345×0 and its one-pixel origin shift, retaining the serialized 345×2 frame as evidence", () => {
    const source = line(),
      target = rebased(source),
      audit = auditGeometry(source, target);
    expect(target.width).toBe(345);
    expect(target.height).toBe(0);
    expect(target.relativeTransform).toEqual([
      [1, 0, 15],
      [0, 1, 62],
    ]);
    expect(audit.dimensions.passed).toBe(true);
    expect(audit.placement.passed).toBe(true);
    expect(audit.dimensions.expected).toMatchObject({
      width: 345,
      height: 0,
      sourceFrame: { width: 345, height: 2 },
    });
  });
  it("compares thin vertical paths without treating the stored frame width as path width", () => {
    const s = line();
    s.frame = { x: 3, y: 4, width: 2.08, height: 7.99 };
    s.points = [{ point: "{0.5, 0}" }, { point: "{0.5, 1}" }];
    expect(rebased(s).width).toBe(0);
    expect(auditGeometry(s, rebased(s)).dimensions.passed).toBe(true);
    expect(auditGeometry(s, rebased(s)).placement.passed).toBe(true);
  });
  it("accepts unrebased path coordinates too, rather than assuming that every target origin is zero", () => {
    const s = line(),
      target = {
        ...frameTarget(s),
        type: "VECTOR" as const,
        vectorNetwork: vectorNetwork(s),
      };
    expect(auditGeometry(s, target).dimensions.passed).toBe(true);
    expect(auditGeometry(s, target).placement.passed).toBe(true);
  });
  it("uses the native path geometry, catching a changed path even if the node frame still looks correct", () => {
    const s = line(),
      target = rebased(s);
    target.vectorNetwork.vertices[1].x -= 1;
    const audit = auditGeometry(s, target);
    expect(audit.dimensions.passed).toBe(false);
    expect(audit.changedDimensions).toEqual(["width"]);
  });
  it("retains real text and frame size discrepancies", () => {
    const s = rect(),
      t = { ...frameTarget(s), height: 49 };
    const audit = auditGeometry(s, t);
    expect(audit.dimensions.passed).toBe(false);
    expect(audit.changedDimensions).toEqual(["height"]);
    expect(audit.placement.passed).toBe(true);
  });
  it.each([90, -45, 180])(
    "accounts for path origin shifts under rotation %s and both flip flags",
    (rotation) => {
      for (const isFlippedHorizontal of [false, true])
        for (const isFlippedVertical of [false, true]) {
          const s = {
            ...line(),
            rotation,
            isFlippedHorizontal,
            isFlippedVertical,
          };
          const audit = auditGeometry(s, rebased(s));
          expect(audit.dimensions.passed).toBe(true);
          expect(audit.placement.passed).toBe(true);
        }
    },
  );
  it("does not report equivalent rotation/flip matrix representations as differences", () => {
    const s = rect(),
      equivalent = {
        ...s,
        rotation: 180,
        isFlippedHorizontal: true,
        isFlippedVertical: true,
      };
    expect(
      auditGeometry(s, {
        ...frameTarget(s),
        relativeTransform: transform(equivalent),
      }).placement.passed,
    ).toBe(true);
  });
  it("identifies movement without blaming rotation or flips", () => {
    const s = line(),
      t = rebased(s);
    t.relativeTransform[1][2] += 1;
    const audit = auditGeometry(s, t);
    expect(audit.dimensions.passed).toBe(true);
    expect(audit.changedPlacement).toEqual(["y"]);
    expect(audit.placement.message).toContain("placement differs in y");
  });
  it("catches a one-degree rotation that the former 0.1 matrix tolerance missed", () => {
    const s = rect(),
      t = frameTarget(s);
    // Keep the local origin stationary to isolate orientation from position.
    const r = transform({ ...s, rotation: 1 });
    r[0][2] = t.relativeTransform[0][2];
    r[1][2] = t.relativeTransform[1][2];
    const audit = auditGeometry(s, { ...t, relativeTransform: r });
    expect(audit.changedPlacement).toEqual(["rotation"]);
  });
  it("detects reflection, scale and skew independently", () => {
    const s = rect(),
      t = frameTarget(s);
    expect(
      auditGeometry(s, {
        ...t,
        relativeTransform: [
          [-1, 0, 10],
          [0, 1, 20],
        ],
      }).changedPlacement,
    ).toEqual(["reflection"]);
    expect(
      auditGeometry(s, {
        ...t,
        relativeTransform: [
          [1.001, 0, 10],
          [0, 1, 20],
        ],
      }).changedPlacement,
    ).toEqual(["scale"]);
    expect(
      auditGeometry(s, {
        ...t,
        relativeTransform: [
          [1, 0.001, 10],
          [0, 1, 20],
        ],
      }).changedPlacement,
    ).toContain("skew");
  });
  it("keeps the original 0.1px position and size threshold", () => {
    const s = rect(),
      t = frameTarget(s);
    t.relativeTransform[0][2] += 0.099;
    expect(auditGeometry(s, { ...t, width: 100.099 }).placement.passed).toBe(
      true,
    );
    expect(auditGeometry(s, { ...t, width: 100.099 }).dimensions.passed).toBe(
      true,
    );
    t.relativeTransform[0][2] += 0.002;
    expect(auditGeometry(s, { ...t, width: 100.101 }).placement.passed).toBe(
      false,
    );
    expect(auditGeometry(s, { ...t, width: 100.101 }).dimensions.passed).toBe(
      false,
    );
  });
  it("does not convert unavailable or invalid geometry into a passing check", () => {
    const s = line(),
      t = rebased(s);
    for (const target of [
      { ...t, vectorNetwork: undefined },
      { ...t, width: NaN },
      {
        ...t,
        relativeTransform: [
          [0, 0, 0],
          [0, 0, 0],
        ] as Transform,
      },
    ]) {
      expect(auditGeometry(s, target).dimensions.passed).toBe(null);
      expect(auditGeometry(s, target).placement.passed).toBe(null);
    }
    t.vectorNetwork.vertices[0].x = NaN;
    expect(auditGeometry(s, t).dimensions.passed).toBe(null);
    expect(
      auditGeometry(
        { ...s, frame: { ...s.frame, width: NaN } },
        rebased(line()),
      ).dimensions.passed,
    ).toBe(null);
  });
});
describe("Bézier bounds", () => {
  const arc = (): Sketch => ({
    ...line(),
    frame: { x: 15, y: 61, width: 100, height: 100 },
    points: [
      { point: "{0, 0}", hasCurveFrom: true, curveFrom: "{0, 1}" },
      { point: "{1, 0}", hasCurveTo: true, curveTo: "{1, 1}" },
    ],
  });
  it("uses curve extrema, excluding the control-handle box", () => {
    expect(networkBounds(vectorNetwork(arc()))).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 75,
    });
  });
  it("includes closed-path segments and extrema outside the serialized frame", () => {
    const s = arc();
    s.isClosed = true;
    s.points[1].hasCurveFrom = true;
    s.points[1].curveFrom = "{1, -1}";
    s.points[0].hasCurveTo = true;
    s.points[0].curveTo = "{0, -1}";
    expect(networkBounds(vectorNetwork(s))).toEqual({
      x: 0,
      y: -75,
      width: 100,
      height: 150,
    });
    const audit = auditGeometry(
      { ...s, rotation: 30, isFlippedVertical: true },
      rebased({ ...s, rotation: 30, isFlippedVertical: true }),
    );
    expect(audit.dimensions.passed).toBe(true);
    expect(audit.placement.passed).toBe(true);
  });
  it("rejects broken segment references and nonfinite handles", () => {
    const network = vectorNetwork(arc());
    const broken = {
      ...network,
      segments: [{ ...network.segments[0], end: 8 }],
    };
    expect(() => networkBounds(broken)).toThrow("indices");
    const invalid = {
      ...network,
      segments: [{ ...network.segments[0], tangentStart: { x: NaN, y: 0 } }],
    };
    expect(() => networkBounds(invalid)).toThrow("handles");
  });
});
it("composes anonymous wrapper transforms, stopping at the actual source-bearing parent", () => {
  const parent = {
    type: "FRAME",
    relativeTransform: [
      [1, 0, 400],
      [0, 1, 500],
    ],
    getPluginData: () => "PARENT",
    parent: null,
  };
  const wrapper = {
    type: "FRAME",
    relativeTransform: [
      [0, -1, 30],
      [1, 0, 40],
    ],
    getPluginData: () => "",
    parent,
  };
  const child = {
    relativeTransform: [
      [1, 0, 2],
      [0, 1, 3],
    ],
    parent: wrapper,
  } as unknown as SceneNode;
  expect(sourceRelativeTransform(child)).toEqual([
    [0, -1, 27],
    [1, 0, 42],
  ]);
});
