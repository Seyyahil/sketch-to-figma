import type { Sketch } from "./types";
export const finite = (n: unknown, fallback = 0): number =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));
export function point(s: unknown): { x: number; y: number } {
  if (typeof s !== "string") throw new Error("Invalid Sketch point");
  const m = s.match(/^\s*\{\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*\}\s*$/);
  if (!m || !Number.isFinite(+m[1]) || !Number.isFinite(+m[2]))
    throw new Error(`Invalid Sketch point: ${s}`);
  return { x: +m[1], y: +m[2] };
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Sketch)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
// A dual 32-bit deterministic content fingerprint (not a security primitive).
export function fingerprint(value: unknown): string {
  const s = typeof value === "string" ? value : stable(value);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ s.charCodeAt(i);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}
export function rgba(c: Sketch = {}, p3 = false): RGBA {
  let r = finite(c.red),
    g = finite(c.green),
    b = finite(c.blue);
  if (p3) {
    const lin = (v: number) =>
      v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const enc = (v: number) =>
      v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
    const R = lin(r),
      G = lin(g),
      B = lin(b);
    r = enc(1.224745 * R - 0.224904 * G);
    g = enc(-0.042058 * R + 1.042081 * G);
    b = enc(-0.019642 * R - 0.078655 * G + 1.098537 * B);
  }
  return {
    r: clamp(r),
    g: clamp(g),
    b: clamp(b),
    a: clamp(finite(c.alpha, 1)),
  };
}
/** Sketch rotates clockwise around the center; Figma transforms are local affine. */
export function transform(s: Sketch): Transform {
  const f = s.frame ?? {};
  const w = finite(f.width),
    h = finite(f.height);
  const theta = (-finite(s.rotation) * Math.PI) / 180;
  const c = Math.cos(theta),
    d = Math.sin(theta),
    sx = s.isFlippedHorizontal ? -1 : 1,
    sy = s.isFlippedVertical ? -1 : 1;
  const a = c * sx,
    b = -d * sy,
    e = d * sx,
    g = c * sy;
  return [
    [a, b, finite(f.x) + w / 2 - (a * w) / 2 - (b * h) / 2],
    [e, g, finite(f.y) + h / 2 - (e * w) / 2 - (g * h) / 2],
  ];
}
export function constraints(mask: number = 63): Constraints {
  const fixed = (bit: number) => (mask & bit) === 0;
  const axis = (start: boolean, end: boolean, size: boolean): ConstraintType =>
    start && end
      ? "STRETCH"
      : start
        ? "MIN"
        : end
          ? "MAX"
          : size
            ? "CENTER"
            : "SCALE";
  return {
    horizontal: axis(fixed(8), fixed(1), fixed(4)),
    vertical: axis(fixed(32), fixed(2), fixed(16)),
  };
}
export function pathData(s: Sketch): string {
  const pts = s.points ?? [];
  if (!pts.length) return "";
  const w = finite(s.frame?.width, 1),
    h = finite(s.frame?.height, 1);
  const xy = (v: unknown) => {
    const p = point(v);
    return `${p.x * w} ${p.y * h}`;
  };
  let d = `M ${xy(pts[0].point)}`;
  const end = s.isClosed ? pts.length : pts.length - 1;
  for (let i = 0; i < end; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    if (a.hasCurveFrom || b.hasCurveTo)
      d += ` C ${xy(a.hasCurveFrom ? a.curveFrom : a.point)} ${xy(b.hasCurveTo ? b.curveTo : b.point)} ${xy(b.point)}`;
    else d += ` L ${xy(b.point)}`;
  }
  return d + (s.isClosed ? " Z" : "");
}
export function gradientTransform(g: Sketch, width = 1, height = 1): Transform {
  const a = point(g.from ?? "{0, 0.5}"),
    b = point(g.to ?? "{1, 0.5}");
  const dx = b.x - a.x,
    dy = b.y - a.y;
  // Inverse of the matrix taking canonical Figma gradient coordinates to Sketch endpoints.
  const ex = (-dy * height) / Math.max(width, 1e-9),
    ey = (dx * width) / Math.max(height, 1e-9);
  const scale = g.gradientType === 1 ? finite(g.elipseLength, 1) : 1;
  const u = ex * scale,
    v = ey * scale;
  const tx = a.x - u * 0.5,
    ty = a.y - v * 0.5,
    det = dx * v - u * dy;
  if (Math.abs(det) < 1e-10) throw new Error("Degenerate gradient endpoints");
  return [
    [v / det, -u / det, (u * ty - v * tx) / det],
    [-dy / det, dx / det, (dy * tx - dx * ty) / det],
  ];
}
export function vectorNetwork(s: Sketch): VectorNetwork {
  const pts: Sketch[] = s.points ?? [],
    w = finite(s.frame?.width, 1),
    h = finite(s.frame?.height, 1),
    xy = (v: unknown) => {
      const p = point(v);
      return { x: p.x * w, y: p.y * h };
    };
  const vertices: VectorVertex[] = pts.map((p) => ({
    ...xy(p.point),
    cornerRadius:
      (p.cornerStyle ?? 0) === 0 ? Math.max(0, finite(p.cornerRadius)) : 0,
    handleMirroring:
      p.curveMode === 2
        ? "ANGLE_AND_LENGTH"
        : p.curveMode === 3
          ? "ANGLE"
          : "NONE",
  }));
  const segments: VectorSegment[] = [];
  for (let i = 0; i < (s.isClosed ? pts.length : pts.length - 1); i++) {
    const j = (i + 1) % pts.length,
      a = vertices[i],
      b = vertices[j],
      ca = xy(pts[i].hasCurveFrom ? pts[i].curveFrom : pts[i].point),
      cb = xy(pts[j].hasCurveTo ? pts[j].curveTo : pts[j].point);
    segments.push({
      start: i,
      end: j,
      tangentStart: { x: ca.x - a.x, y: ca.y - a.y },
      tangentEnd: { x: cb.x - b.x, y: cb.y - b.y },
    });
  }
  return {
    vertices,
    segments,
    regions: s.isClosed
      ? [
          {
            windingRule: s.style?.windingRule === 1 ? "EVENODD" : "NONZERO",
            loops: [segments.map((_, i) => i)],
          },
        ]
      : [],
  };
}
