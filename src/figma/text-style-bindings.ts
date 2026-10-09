import type { ImportContext } from "./context";
import { sourceId, type Sketch } from "../core/types";
import {
  textRanges,
  textRangeValues,
  textStyleValues,
  textStyleDifferences,
  rangeMatches,
  restoreTextRange,
  type TextStyleValues,
} from "./text-style-values";

/** Only a live original source style counts as a preserved style relationship. */
export async function isTextStyleBound(
  ctx: ImportContext,
  sourceStyleId: string,
  node: TextNode,
): Promise<boolean> {
  const original = ctx.resources.texts.get(sourceStyleId);
  if (!original) return false;
  return node.characters.length
    ? textRanges(node).every((range) => range.textStyleId === original.id)
    : node.textStyleId === original.id;
}
/** Accept a native binding only when host readback retains both ID and exact values. */
async function bindOriginal(
  ctx: ImportContext,
  node: TextNode,
  start: number,
  end: number,
  style: TextStyle,
  values: TextStyleValues,
): Promise<boolean> {
  await ctx.api.loadFontAsync(style.fontName);
  await ctx.api.loadFontAsync(values.fontName);
  try {
    if (node.characters.length)
      await node.setRangeTextStyleIdAsync(start, end, style.id);
    else await node.setTextStyleIdAsync(style.id);
    await restoreTextRange(ctx, node, start, end, values);
    if (
      (node.characters.length
        ? node.getRangeTextStyleId(start, end)
        : node.textStyleId) === style.id &&
      rangeMatches(node, start, end, values)
    )
      return true;
  } catch {
    // API hosts differ in writable semantic overrides. Keep the exact source values when a binding cannot be retained.
  }
  await restoreTextRange(ctx, node, start, end, values);
  if (!rangeMatches(node, start, end, values))
    throw new Error(
      `Could not restore exact typography after binding ${style.name}.`,
    );
  return false;
}
/** Only explicit, live Sketch style relationships create original bindings. */
export async function reconcileTextStyleBindings(
  ctx: ImportContext,
  source: Sketch,
  node: TextNode,
  instanceOwner?: Sketch,
): Promise<void> {
  const auditSource = instanceOwner ?? source;
  const auditPath = instanceOwner ? "/symbolID" : "/sharedStyleID";
  const attempt = async (fn: () => Promise<void>) => {
    if (!instanceOwner) return ctx.attempt(source, auditPath, fn);
    // Instance repair must not rewrite the master layer's source-property audit.
    try {
      await fn();
    } catch (error) {
      ctx.finding(
        "API_REJECTED",
        `${node.name} (${node.id}): ${String(error)}`,
        auditSource,
        auditPath,
        "error",
      );
    }
  };
  const sourceStyleId = source.sharedStyleID;
  if (!sourceStyleId) return;
  const style = ctx.resources.texts.get(sourceStyleId);
  if (!style) {
    ctx.finding(
      "TEXT_STYLE_REFERENCE",
      `${source.name}: source Text Style ${sourceStyleId} could not be resolved.`,
      auditSource,
      auditPath,
      "error",
    );
    return;
  }
  // Reconciliation runs again after tokens and instance overrides. Report only final unbound ranges.
  const rangePath = `${auditPath}/${instanceOwner ? node.id + "/" : ""}ranges/`;
  ctx.report.findings = ctx.report.findings.filter(
    (f) =>
      !(
        f.code === "TEXT_STYLE_OVERRIDE" &&
        f.sourceId === sourceId(auditSource) &&
        f.path?.startsWith(rangePath)
      ),
  );
  const segments = node.characters.length
    ? textRanges(node).map((range) => ({
        start: range.start,
        end: range.end,
        textStyleId: range.textStyleId,
        values: textRangeValues(node, range),
      }))
    : [
        {
          start: 0,
          end: 0,
          textStyleId: node.textStyleId,
          values: textStyleValues(node),
        },
      ];
  for (const segment of segments) {
    if (segment.textStyleId === style.id) continue;
    const values = segment.values;
    const differences = textStyleDifferences(values, textStyleValues(style));
    await attempt(async () => {
      if (
        await bindOriginal(ctx, node, segment.start, segment.end, style, values)
      )
        return;
      // Incompatible overrides remain literal: creating another style changes the source library.
      const path = `${rangePath}${segment.start}:${segment.end}`;
      if (
        !ctx.report.findings.some(
          (f) =>
            f.code === "TEXT_STYLE_OVERRIDE" &&
            f.sourceId === sourceId(auditSource) &&
            f.path === path,
        )
      )
        ctx.finding(
          "TEXT_STYLE_OVERRIDE",
          `${source.name}: ${node.characters.length ? `range ${segment.start}–${segment.end}` : "empty text"} cannot retain ${style.name} with its source overrides (${differences.join(", ") || "host rejected binding"}). Exact typography retained without creating a style.`,
          auditSource,
          path,
        );
    });
  }
  if (!instanceOwner) {
    const bound = await isTextStyleBound(ctx, sourceStyleId, node);
    ctx
      .ledger(source)
      .mark(
        "/sharedStyleID",
        bound ? "Native" : "Partial",
        bound
          ? "All ranges retain the original source Text Style."
          : "Incompatible source overrides retain exact values; original style relationship retained in metadata. No additional styles created.",
      );
  }
}
