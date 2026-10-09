import { point, transform, vectorNetwork } from "./math";
import type { Sketch } from "./types";

export type ShapeOperation =
  "NONE" | "UNION" | "SUBTRACT" | "INTERSECT" | "EXCLUDE";
export function shapeOperation(value: unknown): ShapeOperation {
  switch (value ?? 0) {
    case -1:
      return "NONE";
    case 0:
      return "UNION";
    case 1:
      return "SUBTRACT";
    case 2:
      return "INTERSECT";
    case 3:
      return "EXCLUDE";
    default:
      throw new Error(`Unknown Sketch boolean operation: ${String(value)}`);
  }
}
export function windingRule(value: unknown): WindingRule {
  if (value === undefined || value === 0) return "NONZERO";
  if (value === 1) return "EVENODD";
  throw new Error(`Unknown Sketch winding rule: ${String(value)}`);
}
export function mapNetwork(
  network: VectorNetwork,
  t: Transform,
): VectorNetwork {
  const at = (p: { x: number; y: number }, translate = true) => ({
    x: t[0][0] * p.x + t[0][1] * p.y + (translate ? t[0][2] : 0),
    y: t[1][0] * p.x + t[1][1] * p.y + (translate ? t[1][2] : 0),
  });
  return {
    vertices: network.vertices.map((v) => ({ ...v, ...at(v) })),
    segments: network.segments.map((s) => ({
      ...s,
      ...(s.tangentStart ? { tangentStart: at(s.tangentStart, false) } : {}),
      ...(s.tangentEnd ? { tangentEnd: at(s.tangentEnd, false) } : {}),
    })),
    regions: network.regions?.map((r) => ({
      ...r,
      loops: r.loops.map((l) => [...l]),
    })),
  };
}
/** None means concatenate contours, not union their filled areas. All loops must
 * be in ONE region: separate regions fill counters independently. */
export function joinContours(
  networks: VectorNetwork[],
  rule: WindingRule,
): VectorNetwork {
  const vertices: VectorVertex[] = [],
    segments: VectorSegment[] = [],
    loops: number[][] = [];
  for (const n of networks) {
    const v = vertices.length,
      e = segments.length;
    vertices.push(...n.vertices);
    segments.push(
      ...n.segments.map((s) => ({ ...s, start: s.start + v, end: s.end + v })),
    );
    for (const r of n.regions ?? [])
      for (const loop of r.loops) loops.push(loop.map((i) => i + e));
  }
  return {
    vertices,
    segments,
    regions: loops.length ? [{ windingRule: rule, loops }] : [],
  };
}
/** Fill closure is implicit in Sketch/SVG, including paths serialized as open.
 * A repeated endpoint is welded without introducing an extra closing edge. */
export function filledPath(source: Sketch, rule: WindingRule): VectorNetwork {
  if (!source.points?.length)
    throw new Error(`${source.name}: no source contour geometry`);
  const n = vectorNetwork(source),
    vs = [...n.vertices],
    es = n.segments.map((e) => ({ ...e }));
  if (vs.length < 2)
    throw new Error(`${source.name}: degenerate compound contour`);
  const radii = source.style?.corners?.radii;
  if (radii?.length && [0, 1].includes(source.style.corners.style))
    vs.forEach((v, i) => {
      vs[i] = { ...v, cornerRadius: Math.max(0, radii[i % radii.length]) };
    });
  const first = vs[0],
    last = vs[vs.length - 1],
    repeated = first.x === last.x && first.y === last.y;
  if (repeated && !source.isClosed) {
    const tail = vs.length - 1;
    // A source's explicit close after a duplicate endpoint is a zero-length edge.
    for (const e of es) if (e.end === tail) e.end = 0;
    vs.pop();
  } else if (!source.isClosed) es.push({ start: vs.length - 1, end: 0 });
  if (!es.length) throw new Error(`${source.name}: empty compound contour`);
  return {
    vertices: vs,
    segments: es,
    regions: [{ windingRule: rule, loops: [es.map((_, i) => i)] }],
  };
}
export function hasImplicitClosingEdge(s: Sketch): boolean {
  if (s._class === "shapeGroup")
    return (s.layers ?? []).some(hasImplicitClosingEdge);
  if (s.isClosed || !s.points?.length) return false;
  const a = point(s.points[0].point),
    b = point(s.points[s.points.length - 1].point);
  return a.x !== b.x || a.y !== b.y;
}
/** Source coordinates avoid depending on Figma's vector bounds normalization.
 * Nested compounds retain their own fill rule until used as a boolean operand. */
export function sourceContours(s: Sketch, rule: WindingRule): VectorNetwork {
  if (s.isVisible === false) return { vertices: [], segments: [], regions: [] };
  if (s._class === "shapeGroup") {
    if (
      (s.layers ?? [])
        .slice(1)
        .some((c: Sketch) => shapeOperation(c.booleanOperation) !== "NONE")
    )
      throw new Error(
        `${s.name}: nested evaluated boolean requires native geometry`,
      );
    if (windingRule(s.style?.windingRule) !== rule)
      throw new Error(`${s.name}: nested compound uses a different fill rule`);
    return mapNetwork(
      joinContours(
        (s.layers ?? []).map((c: Sketch) => sourceContours(c, rule)),
        rule,
      ),
      transform(s),
    );
  }
  return mapNetwork(filledPath(s, rule), transform(s));
}
