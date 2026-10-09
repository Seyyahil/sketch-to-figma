export function sameFont(
  actual: FontName | symbol,
  expected: FontName,
): boolean {
  return (
    typeof actual !== "symbol" &&
    actual.family === expected.family &&
    actual.style === expected.style &&
    Object.entries(expected.variationSettings ?? {}).every(
      ([tag, v]) => actual.variationSettings?.[tag] === v,
    )
  );
}
/** Compare conversion values with the host's float32 readback, without weakening sync fingerprints. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) < 1e-6;
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameValue(v, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => sameValue(x[k], y[k]))
  );
}
function comparablePaint(p: Paint): unknown {
  const bindings = "boundVariables" in p ? p.boundVariables : undefined;
  const base = {
    ...p,
    visible: p.visible ?? true,
    opacity: p.opacity ?? 1,
    blendMode: p.blendMode ?? "NORMAL",
    boundVariables: Object.keys(bindings ?? {}).length ? bindings : undefined,
  };
  if (p.type === "SOLID" && p.boundVariables?.color)
    return { ...base, color: undefined };
  // Linear gradients use only the transform's first row; the perpendicular
  // coordinate has no effect on color or stop placement.
  if ("gradientStops" in p)
    return {
      ...base,
      gradientTransform:
        p.type === "GRADIENT_LINEAR"
          ? [p.gradientTransform[0]]
          : p.gradientTransform,
      gradientStops: p.gradientStops.map((s) => ({
        ...s,
        boundVariables: Object.keys(s.boundVariables ?? {}).length
          ? s.boundVariables
          : undefined,
        ...(s.boundVariables?.color ? { color: undefined } : {}),
      })),
    };
  return base;
}
export function samePaints(
  a: readonly Paint[] | symbol,
  b: readonly Paint[],
): boolean {
  return (
    typeof a !== "symbol" &&
    sameValue(a.map(comparablePaint), b.map(comparablePaint))
  );
}
