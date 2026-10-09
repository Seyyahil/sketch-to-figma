import { applySerializedStack, applySerializedItem } from "./serialized-layout";
import { finite } from "../core/math";
import type { Sketch } from "../core/types";
import type { ImportContext } from "./context";
export async function applyGuidesGrids(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode | PageNode,
): Promise<void> {
  const l = ctx.ledger(s);
  if ("guides" in node) {
    const checkpoint = l.checkpoint();
    const guides: Guide[] = [];
    for (const [key, axis] of [
      ["horizontalRulerData", "Y"],
      ["verticalRulerData", "X"],
    ] as const) {
      const r = s[key];
      for (const [i, offset] of (r?.guides ?? []).entries()) {
        guides.push({ axis, offset: finite(offset) + finite(r.base) });
        l.mark(`/${key}/guides/${i}`);
      }
      if (r) l.fields(`/${key}`, ["_class", "base"]);
    }
    const accepted = await ctx.attempt(s, "/guides", () => {
      node.guides = guides;
    });
    if (!accepted) l.rollback(checkpoint);
  }
  if ("layoutGrids" in node) {
    const checkpoint = l.checkpoint();
    const grids: LayoutGrid[] = [],
      g = s.grid,
      layout = s.layout,
      color: RGBA = { r: 1, g: 0, b: 0, a: 0.1 };
    if (g) {
      grids.push({
        pattern: "GRID",
        sectionSize: Math.max(1, finite(g.gridSize, 8)),
        visible: g.isEnabled !== false,
        color,
      });
      l.fields("/grid", ["_class", "gridSize", "isEnabled"]);
    }
    if (layout) {
      if (layout.drawVertical !== false)
        grids.push({
          pattern: "COLUMNS",
          alignment: "MIN",
          gutterSize: Math.max(0, finite(layout.gutterWidth)),
          count: Math.max(1, finite(layout.numberOfColumns, 1)),
          sectionSize: Math.max(1, finite(layout.columnWidth, 1)),
          offset: finite(layout.horizontalOffset),
          visible: layout.isEnabled !== false,
          color,
        });
      if (layout.drawHorizontal)
        grids.push({
          pattern: "ROWS",
          alignment: "MIN",
          gutterSize: Math.max(0, finite(layout.gutterHeight)),
          count: Infinity,
          sectionSize: Math.max(1, finite(layout.rowHeightMultiplication, 1)),
          offset: 0,
          visible: layout.isEnabled !== false,
          color,
        });
      l.fields("/layout", [
        "_class",
        "isEnabled",
        "drawVertical",
        "numberOfColumns",
        "columnWidth",
        "gutterWidth",
        "horizontalOffset",
      ]);
      if (layout.drawHorizontal)
        l.fields(
          "/layout",
          ["drawHorizontal", "gutterHeight", "rowHeightMultiplication"],
          "Partial",
          "Sketch horizontal-grid multiplier approximated as native row size.",
        );
    }
    const accepted = await ctx.attempt(s, "/layoutGrids", () => {
      node.layoutGrids = grids;
    });
    if (!accepted) l.rollback(checkpoint);
  }
}
export async function applyLayout(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
): Promise<void> {
  if (!("layoutMode" in node) || node.type === "INSTANCE") return;
  if (await applySerializedStack(ctx, s, node)) return;
  const gl = s.groupLayout,
    l = ctx.ledger(s);
  if (gl?._class === "MSImmutableInferredGroupLayout") {
    const horizontal = gl.axis === 0,
      children = (s.layers ?? []).filter((n: Sketch) => n.isVisible !== false),
      axis = horizontal ? "x" : "y",
      size = horizontal ? "width" : "height";
    const sorted = [...children].sort((a, b) => a.frame[axis] - b.frame[axis]);
    const gaps = sorted
      .slice(1)
      .map(
        (n, i) => n.frame[axis] - sorted[i].frame[axis] - sorted[i].frame[size],
      );
    const gap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const start = sorted[0]?.frame[axis] ?? 0;
    const far = Math.max(
      0,
      ...children.map((c: Sketch) => c.frame[axis] + c.frame[size]),
    );
    await ctx.attempt(
      s,
      "/groupLayout",
      () => {
        node.layoutMode = horizontal ? "HORIZONTAL" : "VERTICAL";
        node.primaryAxisSizingMode = "FIXED";
        node.counterAxisSizingMode = "FIXED";
        node.itemSpacing = gap;
        node.primaryAxisAlignItems =
          (["MIN", "CENTER", "MAX"] as const)[gl.layoutAnchor ?? 0] ?? "MIN";
        node.counterAxisAlignItems = "MIN";
        if (horizontal) {
          node.paddingLeft = Math.max(0, start);
          node.paddingRight = Math.max(0, node.width - far);
        } else {
          node.paddingTop = Math.max(0, start);
          node.paddingBottom = Math.max(0, node.height - far);
        }
      },
      ["_class", "axis", "layoutAnchor"],
      "Partial",
      "Legacy Smart Layout translated to measured Auto Layout. Sketch resizing semantics and nonuniform gaps may differ.",
    );
    ctx.finding(
      "SMART_LAYOUT_APPROXIMATION",
      "Legacy Smart Layout uses measured Auto Layout; validate responsive behavior.",
      s,
      "/groupLayout",
    );
  }
  // Optional versioned DOM sidecars cover explicitly supplied layout semantics in other document versions.
  const stack = s.bridge?.stackLayout;
  if (stack) {
    const path = "/bridge/stackLayout";
    const dir =
      stack.direction === "Row"
        ? "HORIZONTAL"
        : stack.direction === "Column"
          ? "VERTICAL"
          : null;
    if (!dir) {
      ctx.finding(
        "STACK_DIRECTION",
        "Unrecognized sidecar Stack direction.",
        s,
        path,
      );
      return;
    }
    await ctx.attempt(
      s,
      path,
      () => {
        node.layoutMode = dir;
        node.layoutWrap = stack.wraps ? "WRAP" : "NO_WRAP";
        node.primaryAxisSizingMode = "FIXED";
        node.counterAxisSizingMode = "FIXED";
        node.itemSpacing = finite(stack.gap);
        if (stack.wraps) node.counterAxisSpacing = finite(stack.crossAxisGap);
        const aligns: Record<
          string,
          | "MIN"
          | "CENTER"
          | "MAX"
          | "SPACE_BETWEEN"
          | "SPACE_AROUND"
          | "SPACE_EVENLY"
        > = {
          Start: "MIN",
          Center: "CENTER",
          End: "MAX",
          Between: "SPACE_BETWEEN",
          Around: "SPACE_AROUND",
          Evenly: "SPACE_EVENLY",
        };
        node.primaryAxisAlignItems = aligns[stack.justifyContent] ?? "MIN";
        node.counterAxisAlignItems =
          stack.alignItems === "Center"
            ? "CENTER"
            : stack.alignItems === "End"
              ? "MAX"
              : "MIN";
        const p = stack.padding ?? 0;
        node.paddingTop =
          typeof p === "number" ? p : finite(p.top, finite(p.vertical));
        node.paddingBottom =
          typeof p === "number" ? p : finite(p.bottom, finite(p.vertical));
        node.paddingLeft =
          typeof p === "number" ? p : finite(p.left, finite(p.horizontal));
        node.paddingRight =
          typeof p === "number" ? p : finite(p.right, finite(p.horizontal));
        node.itemReverseZIndex = stack.stackingOrder === "FirstOnTop";
        node.strokesIncludedInLayout = !!stack.bordersAffectLayout;
      },
      [
        "direction",
        "wraps",
        "gap",
        "crossAxisGap",
        "alignItems",
        "stackingOrder",
        "bordersAffectLayout",
      ],
      "Partial",
      "Versioned Sketch DOM sidecar mapped to Auto Layout; validate against current Sketch renders.",
    );
    if (
      !["Start", "Center", "End", "Between", "Around", "Evenly"].includes(
        stack.justifyContent,
      )
    )
      ctx.finding(
        "STACK_DISTRIBUTION",
        `Unrecognized sidecar distribution ${stack.justifyContent}; original value retained in metadata.`,
        s,
        `${path}/justifyContent`,
      );
    else l.mark(`${path}/justifyContent`);
    if (typeof stack.padding === "number") l.mark(`${path}/padding`);
    else
      l.fields(`${path}/padding`, [
        "top",
        "bottom",
        "left",
        "right",
        "horizontal",
        "vertical",
      ]);
  }
}
export async function applyChildLayout(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
): Promise<void> {
  if (
    !node.parent ||
    !("layoutMode" in node.parent) ||
    node.parent.layoutMode === "NONE" ||
    !("layoutPositioning" in node)
  )
    return;
  if (s.flexItem || s.horizontalSizing !== undefined)
    await applySerializedItem(ctx, s, node);
  const b = s.bridge;
  if (!b) return;
  const l = ctx.ledger(s);
  if (b.ignoresStackLayout) {
    node.layoutPositioning = "ABSOLUTE";
    l.mark("/bridge/ignoresStackLayout");
  } else node.layoutPositioning = "AUTO";
  const sizing = (value: string): "FIXED" | "HUG" | "FILL" =>
    value === "Fill" ? "FILL" : value === "Fit" ? "HUG" : "FIXED";
  for (const [key, field] of [
    ["horizontalSizing", "layoutSizingHorizontal"],
    ["verticalSizing", "layoutSizingVertical"],
  ] as const)
    if (b[key])
      await ctx.attempt(
        s,
        `/bridge/${key}`,
        () => {
          node[field] = sizing(b[key]);
        },
        [],
        b[key] === "Relative" ? "Partial" : "Native",
        b[key] === "Relative"
          ? "Percentage sizing retained; fixed source dimension used."
          : undefined,
      );
  for (const [key, prefix] of [
    ["minSize", "min"],
    ["maxSize", "max"],
  ] as const)
    for (const dim of ["width", "height"] as const)
      if (b[key]?.[dim] !== undefined) {
        const field = `${prefix}${dim === "width" ? "Width" : "Height"}` as
          "minWidth" | "minHeight" | "maxWidth" | "maxHeight";
        await ctx.attempt(s, `/bridge/${key}/${dim}`, () => {
          node[field] = b[key][dim];
        });
      }
  if (b.preservesSpaceInStackLayoutWhenHidden && s.isVisible === false)
    ctx.finding(
      "HIDDEN_LAYOUT_SPACE",
      "Figma hidden children do not reserve Stack space; source setting retained.",
      s,
      "/bridge/preservesSpaceInStackLayoutWhenHidden",
    );
}
