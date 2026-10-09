import type { Sketch } from "../core/types";
import { finite, transform, point } from "../core/math";
import type { ImportContext } from "./context";

// Numeric enums verified against sketch-hq/SketchAPI Source/dom/models/StackLayout.js
// and Source/dom/layers/Layer.js. Source order is back-to-front; Stack flow is reversed.
const cyclicFit = (s: Sketch, key: string) =>
  s[key] === 1 &&
  (s.layers ?? []).some(
    (child: Sketch) => !child.flexItem?.ignoreLayout && child[key] === 2,
  );
export const primaryAlignments = [
  "MIN",
  "CENTER",
  "MAX",
  "SPACE_BETWEEN",
  "SPACE_AROUND",
  "SPACE_EVENLY",
] as const;
export const isStack = (s: Sketch) =>
  s.groupLayout?._class === "MSImmutableFlexGroupLayout";
export async function applySerializedStack(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
): Promise<boolean> {
  if (!isStack(s) || !("layoutMode" in node) || node.type === "INSTANCE")
    return false;
  const g = s.groupLayout,
    l = ctx.ledger(s),
    horizontal = g.flexDirection === 0;
  if (![0, 1].includes(g.flexDirection)) {
    ctx.finding(
      "STACK_DIRECTION",
      `Unknown Stack direction ${g.flexDirection}.`,
      s,
      "/groupLayout/flexDirection",
      "error",
    );
    return true;
  }
  const accepted = await ctx.attempt(
    s,
    "/groupLayout",
    () => {
      node.layoutMode = horizontal ? "HORIZONTAL" : "VERTICAL";
      node.layoutWrap = g.wrappingEnabled ? "WRAP" : "NO_WRAP";
      node.primaryAxisSizingMode = "FIXED";
      node.counterAxisSizingMode = "FIXED";
      node.primaryAxisAlignItems = primaryAlignments[g.justifyContent] ?? "MIN";
      node.counterAxisAlignItems =
        (["MIN", "CENTER", "MAX"] as const)[g.alignItems] ?? "MIN";
      node.counterAxisAlignContent =
        g.alignContent === 3 ? "SPACE_BETWEEN" : "AUTO";
      node.itemSpacing = finite(g.allGuttersGap);
      if (g.wrappingEnabled)
        node.counterAxisSpacing = finite(g.crossAxisGutterGap);
      node.paddingLeft = finite(s.leftPadding);
      node.paddingRight = finite(s.rightPadding);
      node.paddingTop = finite(s.topPadding);
      node.paddingBottom = finite(s.bottomPadding);
      node.itemReverseZIndex = g.stackingOrder !== 1;
      if (typeof g.bordersAffectLayout === "boolean")
        node.strokesIncludedInLayout = g.bordersAffectLayout;
      const children = [...node.children].reverse();
      children.forEach((child, i) => node.insertChild(i, child));
      // Enabling layout immediately recomputes bounds. Restore source fixed bounds
      // before selecting the source sizing modes or positioning children.
      node.resize(
        Math.max(0.01, finite(s.frame?.width, 1)),
        Math.max(0.01, finite(s.frame?.height, 1)),
      );
    },
    [
      "_class",
      "flexDirection",
      "wrappingEnabled",
      "allGuttersGap",
      "crossAxisGutterGap",
    ],
  );
  if (!accepted) return true;
  l.fields("", [
    "leftPadding",
    "rightPadding",
    "topPadding",
    "bottomPadding",
    "paddingSelection",
  ]);
  if (Number.isInteger(g.justifyContent) && primaryAlignments[g.justifyContent])
    l.mark("/groupLayout/justifyContent");
  else
    ctx.finding(
      "STACK_DISTRIBUTION",
      `Unrecognized Sketch distribution ${g.justifyContent}. Original positions and distribution retained in metadata.`,
      s,
      "/groupLayout/justifyContent",
    );
  if ([0, 1, 2, 3].includes(g.alignItems)) l.mark("/groupLayout/alignItems");
  else
    ctx.finding(
      "STACK_ALIGNMENT",
      `Unknown Stack alignment ${g.alignItems}.`,
      s,
      "/groupLayout/alignItems",
    );
  if ([0, 1].includes(g.stackingOrder)) l.mark("/groupLayout/stackingOrder");
  else if (g.stackingOrder !== undefined)
    ctx.finding(
      "STACK_ORDER",
      `Unknown Stack stacking order ${g.stackingOrder}.`,
      s,
      "/groupLayout/stackingOrder",
    );
  if (typeof g.bordersAffectLayout === "boolean")
    l.mark(
      "/groupLayout/bordersAffectLayout",
      g.bordersAffectLayout ? "Partial" : "Native",
      g.bordersAffectLayout
        ? "Figma border-box layout enabled. Sketch measures protruding child borders; the two layout models require native visual verification."
        : "Stroke-inclusive layout disabled as in the source.",
    );
  if ([0, 3].includes(g.alignContent)) l.mark("/groupLayout/alignContent");
  else
    ctx.finding(
      "STACK_ALIGN_CONTENT",
      `Wrapped line distribution ${g.alignContent} has no native Figma equivalent.`,
      s,
      "/groupLayout/alignContent",
    );
  l.mark(
    "/_class",
    "Editable Equivalent",
    "Sketch container converted to native Auto Layout. Flow order reversed from source back-to-front stacking; first-on-top preserves overlap order.",
  );
  // Apply child sizing after the parent has acquired Auto Layout capability.
  for (const child of s.layers ?? []) {
    const target = ctx.nodes.get(String(child.do_objectID));
    if (target) await applySerializedItem(ctx, child, target, s);
  }
  const primary = horizontal ? s.horizontalSizing : s.verticalSizing,
    cross = horizontal ? s.verticalSizing : s.horizontalSizing;
  const primaryKey = horizontal ? "horizontalSizing" : "verticalSizing",
    crossKey = horizontal ? "verticalSizing" : "horizontalSizing";
  node.primaryAxisSizingMode =
    primary === 1 && !cyclicFit(s, primaryKey) ? "AUTO" : "FIXED";
  node.counterAxisSizingMode =
    cross === 1 && !cyclicFit(s, crossKey) ? "AUTO" : "FIXED";
  for (const key of [primaryKey, crossKey])
    if (cyclicFit(s, key)) {
      l.mark(
        `/${key}`,
        "Partial",
        "Content-based parent with Fill children forms a sizing cycle in Figma. Source parent dimension retained as fixed; child Fill and text wrapping remain editable.",
      );
      ctx.finding(
        "CYCLIC_LAYOUT",
        "Source Fit container has Fill children on the same axis. Preserved its source dimension to prevent intrinsic-width expansion.",
        s,
        `/${key}`,
      );
    }
  for (const key of ["horizontalSizing", "verticalSizing"])
    if ([0, 1].includes(s[key]) && !cyclicFit(s, key)) l.mark(`/${key}`);
  return true;
}
export async function applySerializedItem(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
  parentSource?: Sketch,
): Promise<void> {
  const parent = node.parent;
  if (
    !parent ||
    !("layoutMode" in parent) ||
    parent.layoutMode === "NONE" ||
    !("layoutPositioning" in node)
  )
    return;
  const l = ctx.ledger(s),
    item = s.flexItem;
  // Sketch serializes Stack limits as NSSize strings; zero means no limit on that axis.
  for (const [key, width, height] of [
    ["minSize", "minWidth", "minHeight"],
    ["maxSize", "maxWidth", "maxHeight"],
  ] as const)
    if (s[key] !== undefined && width in node && height in node)
      await ctx.attempt(s, `/${key}`, () => {
        const size = point(s[key]);
        if (size.x < 0 || size.y < 0) throw new Error(`Invalid Sketch ${key}`);
        node[width] = size.x || null;
        node[height] = size.y || null;
      });
  if (item) {
    node.layoutPositioning = item.ignoreLayout ? "ABSOLUTE" : "AUTO";
    // Reapplying child sizing must not erase inherited Stretch selected by its parent.
    node.layoutAlign =
      (["MIN", "CENTER", "MAX", "STRETCH"] as const)[item.alignSelf] ??
      (parentSource?.groupLayout.alignItems === 3
        ? "STRETCH"
        : node.layoutAlign === "STRETCH"
          ? "STRETCH"
          : "INHERIT");
    if (item.ignoreLayout) node.relativeTransform = transform(s);
    l.fields("/flexItem", ["_class", "alignSelf", "ignoreLayout"]);
    if (!item.preserveSpaceWhenHidden)
      l.mark("/flexItem/preserveSpaceWhenHidden");
    else
      ctx.finding(
        "HIDDEN_LAYOUT_SPACE",
        "Figma hidden children do not reserve Stack space. Source setting retained.",
        s,
        "/flexItem/preserveSpaceWhenHidden",
      );
  }
  if (
    "resize" in node &&
    (s.horizontalSizing === 0 ||
      s.verticalSizing === 0 ||
      cyclicFit(s, "horizontalSizing") ||
      cyclicFit(s, "verticalSizing"))
  )
    node.resize(
      s.horizontalSizing === 0 || cyclicFit(s, "horizontalSizing")
        ? Math.max(0.01, finite(s.frame?.width, 1))
        : node.width,
      s.verticalSizing === 0 || cyclicFit(s, "verticalSizing")
        ? Math.max(0.01, finite(s.frame?.height, 1))
        : node.height,
    );
  for (const [key, field] of [
    ["horizontalSizing", "layoutSizingHorizontal"],
    ["verticalSizing", "layoutSizingVertical"],
  ] as const) {
    if (s[key] === undefined) continue;
    let sizing: "FIXED" | "HUG" | "FILL" =
      s[key] === 1 ? "HUG" : s[key] === 2 ? "FILL" : "FIXED";
    if (cyclicFit(s, key)) sizing = "FIXED";
    let reason = cyclicFit(s, key)
      ? "Fit/Fill cycle represented by the fixed source parent dimension with live child Fill sizing."
      : s[key] === 3
        ? "Relative percentage sizing has no direct native equivalent; source dimension retained."
        : undefined;
    if (item?.ignoreLayout && sizing === "FILL") {
      sizing = "FIXED";
      reason =
        "Absolute child Fill sizing cannot participate in Figma Auto Layout; source dimension retained.";
    }
    if (
      sizing === "HUG" &&
      node.type !== "TEXT" &&
      (!("layoutMode" in node) || node.layoutMode === "NONE")
    ) {
      sizing = "FIXED";
      reason =
        "Freeform content-based sizing has no native Auto Layout hug equivalent; source dimension retained.";
    }
    await ctx.attempt(
      s,
      `/${key}`,
      () => {
        node[field] = sizing;
      },
      [],
      reason ? "Partial" : "Native",
      reason,
    );
  }
  if (parentSource?.groupLayout.alignItems === 3 && item?.alignSelf === 5)
    node.layoutAlign = "STRETCH";
}
