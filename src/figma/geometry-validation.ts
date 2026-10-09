import { transform, vectorNetwork } from "../core/math";
import { sourceId, type Sketch, type Validation } from "../core/types";

// Different units need different tolerances. Keep the existing 0.1px size/position threshold.
export const GEOMETRY_TOLERANCE = {
  pixels: 0.1,
  degrees: 0.01,
  scale: 0.00001,
} as const;
type Point = { x: number; y: number };
export interface Bounds extends Point {
  width: number;
  height: number;
}
type GeometryTarget = Pick<
  SceneNode,
  "type" | "width" | "height" | "relativeTransform"
> & {
  vectorNetwork?: VectorNetwork;
};
export interface GeometryAudit {
  dimensions: Validation;
  placement: Validation;
  changedDimensions: ("width" | "height")[];
  changedPlacement: string[];
}

export function multiplyTransforms(a: Transform, b: Transform): Transform {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2],
    ],
  ];
}
function at(t: Transform, p: Point): Point {
  return {
    x: t[0][0] * p.x + t[0][1] * p.y + t[0][2],
    y: t[1][0] * p.x + t[1][1] * p.y + t[1][2],
  };
}
function validPoint(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
function validTransform(t: Transform): boolean {
  return (
    t.length === 2 &&
    t.every((row) => row.length === 3 && row.every(Number.isFinite))
  );
}
function determinant(t: Transform): number {
  return t[0][0] * t[1][1] - t[0][1] * t[1][0];
}
function angle(a: Point, b: Point): number {
  return (
    (Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180) / Math.PI
  );
}
function cubic(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}
/** Interior extrema of a cubic; includes the quadratic/linear degeneracies. */
function extrema(a: number, b: number, c: number, d: number): number[] {
  const A = -a + 3 * b - 3 * c + d,
    B = 2 * (a - 2 * b + c),
    C = b - a;
  if (![A, B, C].every(Number.isFinite))
    throw new Error("Nonfinite Bézier coefficients");
  const epsilon = 1e-12 * Math.max(1, Math.abs(A), Math.abs(B), Math.abs(C));
  if (Math.abs(A) < epsilon)
    return Math.abs(B) < epsilon ? [] : [-C / B].filter((t) => t > 0 && t < 1);
  const discriminant = B * B - 4 * A * C;
  if (!Number.isFinite(discriminant))
    throw new Error("Nonfinite Bézier discriminant");
  if (discriminant < 0) return [];
  // Avoid cancellation when one root is much smaller than the other.
  const q = -0.5 * (B + (B < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return (q === 0 ? [-B / (2 * A)] : [q / A, C / q]).filter(
    (t) => t > 0 && t < 1,
  );
}
/** Unstroked path bounds, including Bézier extrema (not the control-handle box).
 * Live corner rounding, strokes and effects are outside this bounds comparison.
 */
export function networkBounds(network: VectorNetwork): Bounds {
  const vertices = network.vertices;
  if (!vertices.length || !vertices.every(validPoint))
    throw new Error("Missing or invalid vector vertices");
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (p: Point) => {
    if (!validPoint(p)) throw new Error("Invalid vector coordinates");
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  vertices.forEach(include);
  for (const segment of network.segments) {
    const a = vertices[segment.start],
      d = vertices[segment.end];
    if (!a || !d) throw new Error("Invalid vector segment indices");
    const b = {
      x: a.x + (segment.tangentStart?.x ?? 0),
      y: a.y + (segment.tangentStart?.y ?? 0),
    };
    const c = {
      x: d.x + (segment.tangentEnd?.x ?? 0),
      y: d.y + (segment.tangentEnd?.y ?? 0),
    };
    if (!validPoint(b) || !validPoint(c))
      throw new Error("Invalid Bézier handles");
    for (const t of [
      ...extrema(a.x, b.x, c.x, d.x),
      ...extrema(a.y, b.y, c.y, d.y),
    ])
      include({
        x: cubic(a.x, b.x, c.x, d.x, t),
        y: cubic(a.y, b.y, c.y, d.y, t),
      });
  }
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  if (!Object.values(bounds).every(Number.isFinite))
    throw new Error("Nonfinite vector bounds");
  return bounds;
}

/** Compare in each object's unrotated path/frame basis, then compare that basis in
 * the source parent's coordinates. A native vector's origin may be rebased by Figma;
 * moving its vertices and compensating its transform must not look like content loss.
 */
export function auditGeometry(
  source: Sketch,
  target: GeometryTarget,
  actualTransform = target.relativeTransform,
): GeometryAudit {
  const id = sourceId(source),
    name = source.name ?? id;
  const isPath =
    target.type === "VECTOR" &&
    Array.isArray(source.points) &&
    source.points.length > 0;
  const basis = isPath
    ? "Unstroked path bounds before live corner rounding; stroke/effect appearance is outside this size check."
    : "Unrotated layer frame; strokes and effects excluded.";
  let expectedBounds: Bounds,
    actualBounds: Bounds,
    expectedTransform: Transform;
  try {
    const f = source.frame;
    if (
      !f ||
      ![f.x, f.y, f.width, f.height].every(Number.isFinite) ||
      f.width < 0 ||
      f.height < 0 ||
      (source.rotation !== undefined && !Number.isFinite(source.rotation))
    )
      throw new Error("Invalid source frame or rotation");
    expectedTransform = transform(source);
    expectedBounds = isPath
      ? networkBounds(vectorNetwork(source))
      : { x: 0, y: 0, width: f.width, height: f.height };
    if (isPath && !target.vectorNetwork)
      throw new Error("Native vector network could not be read");
    actualBounds = isPath
      ? networkBounds(target.vectorNetwork!)
      : { x: 0, y: 0, width: target.width, height: target.height };
    if (
      ![
        actualBounds.width,
        actualBounds.height,
        target.width,
        target.height,
      ].every(Number.isFinite) ||
      actualBounds.width < 0 ||
      actualBounds.height < 0 ||
      !validTransform(expectedTransform) ||
      !validTransform(actualTransform) ||
      !Number.isFinite(determinant(actualTransform)) ||
      Math.abs(determinant(actualTransform)) < 1e-12
    )
      throw new Error("Invalid native bounds or transform");
    if (
      !validPoint(at(expectedTransform, expectedBounds)) ||
      !validPoint(at(actualTransform, actualBounds))
    )
      throw new Error("Nonfinite placed geometry");
  } catch (error) {
    const message = `${name}: geometry comparison could not run: ${error instanceof Error ? error.message : String(error)}.`;
    return {
      dimensions: { kind: "geometry", sourceId: id, passed: null, message },
      placement: { kind: "transform", sourceId: id, passed: null, message },
      changedDimensions: [],
      changedPlacement: [],
    };
  }
  const changedDimensions = (["width", "height"] as const).filter(
    (axis) =>
      Math.abs(expectedBounds[axis] - actualBounds[axis]) >=
      GEOMETRY_TOLERANCE.pixels,
  );
  const expectedOrigin = at(expectedTransform, expectedBounds),
    actualOrigin = at(actualTransform, actualBounds);
  const sourceAxes = [
    { x: expectedTransform[0][0], y: expectedTransform[1][0] },
    { x: expectedTransform[0][1], y: expectedTransform[1][1] },
  ];
  const targetAxes = [
    { x: actualTransform[0][0], y: actualTransform[1][0] },
    { x: actualTransform[0][1], y: actualTransform[1][1] },
  ];
  const scale = targetAxes.map(
    (p, i) =>
      Math.hypot(p.x, p.y) / Math.hypot(sourceAxes[i].x, sourceAxes[i].y),
  );
  const reflected =
    determinant(expectedTransform) * determinant(actualTransform) < 0;
  const axisAngles = sourceAxes.map((p, i) => angle(p, targetAxes[i]));
  const skew =
    angle(targetAxes[0], targetAxes[1]) - angle(sourceAxes[0], sourceAxes[1]);
  const changedPlacement: string[] = [];
  for (const axis of ["x", "y"] as const)
    if (
      Math.abs(actualOrigin[axis] - expectedOrigin[axis]) >=
      GEOMETRY_TOLERANCE.pixels
    )
      changedPlacement.push(axis);
  if (reflected) changedPlacement.push("reflection");
  else {
    if (Math.abs(axisAngles[0]) >= GEOMETRY_TOLERANCE.degrees)
      changedPlacement.push("rotation");
    if (Math.abs(skew) >= GEOMETRY_TOLERANCE.degrees)
      changedPlacement.push("skew");
  }
  if (scale.some((v) => Math.abs(v - 1) >= GEOMETRY_TOLERANCE.scale))
    changedPlacement.push("scale");
  return {
    dimensions: {
      kind: "geometry",
      sourceId: id,
      passed: !changedDimensions.length,
      expected: {
        width: expectedBounds.width,
        height: expectedBounds.height,
        basis,
        sourceFrame: source.frame,
        pathOrigin: { x: expectedBounds.x, y: expectedBounds.y },
        tolerancePx: GEOMETRY_TOLERANCE.pixels,
      },
      actual: {
        width: actualBounds.width,
        height: actualBounds.height,
        nodeFrame: { width: target.width, height: target.height },
        pathOrigin: { x: actualBounds.x, y: actualBounds.y },
      },
      message: `${name}: ${changedDimensions.length ? `${changedDimensions.join(" and ")} differ by at least ${GEOMETRY_TOLERANCE.pixels}px` : `dimensions match within ${GEOMETRY_TOLERANCE.pixels}px`}. ${basis}`,
    },
    placement: {
      kind: "transform",
      sourceId: id,
      passed: !changedPlacement.length,
      expected: {
        origin: expectedOrigin,
        matrix: expectedTransform,
        basis: `${isPath ? "Path bounds origin" : "Frame origin"} relative to the nearest source-bearing parent.`,
        tolerance: GEOMETRY_TOLERANCE,
      },
      actual: {
        origin: actualOrigin,
        matrix: actualTransform,
        differences: changedPlacement,
        delta: {
          x: actualOrigin.x - expectedOrigin.x,
          y: actualOrigin.y - expectedOrigin.y,
          rotationDegrees: reflected ? null : axisAngles[0],
          reflection: reflected,
          scaleX: scale[0],
          scaleY: scale[1],
          skewDegrees: reflected ? null : skew,
        },
      },
      message: `${name}: ${changedPlacement.length ? `placement differs in ${changedPlacement.join(", ")}` : "position and orientation match"}. Vector-origin rebasing and anonymous wrappers are accounted for; equivalent rotation/flip matrices are accepted.`,
    },
    changedDimensions,
    changedPlacement,
  };
}

/** Account for anonymous boolean/mask wrappers, stopping at the actual source parent. */
export function sourceRelativeTransform(node: SceneNode): Transform {
  let result = node.relativeTransform,
    parent = node.parent;
  while (
    parent &&
    parent.type !== "PAGE" &&
    "relativeTransform" in parent &&
    !parent.getPluginData("sketch2figma:sourceId")
  ) {
    result = multiplyTransforms(parent.relativeTransform, result);
    parent = parent.parent;
  }
  return result;
}
