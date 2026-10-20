import type { Sketch } from "../core/types";

/**
 * A Symbol's serialized fill is not necessarily visible content. Modern Sketch
 * group Symbols retain dormant Frame fills; Frame Symbols can also exclude
 * their background from instances. Legacy Symbols use backgroundColor instead.
 */
export function symbolBackground(
  source: Sketch,
): "style" | "legacy" | "none" | undefined {
  if (source._class !== "symbolMaster") return undefined;
  if (
    source.includeBackgroundColorInInstance === false ||
    source.includeBackgroundColorInInstance === 0
  )
    return "none";
  if (source.groupBehavior !== undefined)
    return source.groupBehavior === 1 ? "style" : "none";
  if (source.hasBackgroundColor !== undefined)
    return source.hasBackgroundColor ? "legacy" : "none";
  return "style";
}

export function usesStyleFills(source: Sketch): boolean {
  const background = symbolBackground(source);
  return background === undefined || background === "style";
}

export function usesLegacyBackground(source: Sketch): boolean {
  return (
    (source._class === "artboard" && !!source.hasBackgroundColor) ||
    symbolBackground(source) === "legacy"
  );
}
