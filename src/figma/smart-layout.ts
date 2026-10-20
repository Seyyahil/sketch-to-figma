import { sourceId, type Sketch } from "../core/types";
import type { ImportContext } from "./context";

type Alignment = "MIN" | "CENTER" | "MAX";
type LayoutNode = Exclude<
  Extract<SceneNode, { layoutMode: unknown }>,
  InstanceNode
>;
type Plan =
  | { reason: string }
  | {
      direction: "HORIZONTAL" | "VERTICAL";
      order: Sketch[];
      gap: number;
      crossAlignment: Alignment;
      reverseZ: boolean;
      padding: { top: number; right: number; bottom: number; left: number };
    };
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;

/** A legacy background + auto-width label + fixed trailing Symbol is not flex flow. */
export function smartLayoutAffixPlan(
  source: Sketch,
): { label: Sketch; affix: Sketch } | undefined {
  if (source.groupLayout?.axis !== 0 || source.groupLayout?.layoutAnchor !== 0)
    return;
  const children: Sketch[] = (source.layers ?? []).filter(
    (child: Sketch) => child.isVisible !== false,
  );
  if (children.length !== 3) return;
  const [background, label, affix] = children;
  const frame = source.frame;
  if (
    !frame ||
    background._class !== "rectangle" ||
    label._class !== "text" ||
    (label.textBehaviour ?? 0) !== 0 ||
    affix._class !== "symbolInstance" ||
    children.some(
      (child) =>
        !child.frame ||
        child.rotation ||
        child.isFlippedHorizontal ||
        child.isFlippedVertical ||
        child.hasClippingMask ||
        child.flexItem?.ignoreLayout ||
        child.bridge?.ignoresStackLayout,
    )
  )
    return;
  const b = background.frame,
    l = label.frame,
    a = affix.frame;
  if (
    !close(b.x, 0) ||
    !close(b.y, 0) ||
    !close(b.width, frame.width) ||
    !close(b.height, frame.height) ||
    ![l, a].every(
      (f) =>
        [f.x, f.y, f.width, f.height].every(Number.isFinite) &&
        f.width > 0 &&
        f.height > 0 &&
        f.x >= 0 &&
        f.y >= 0 &&
        f.x + f.width <= frame.width &&
        f.y + f.height <= frame.height,
    ) ||
    l.x + l.width > a.x
  )
    return;
  return { label, affix };
}

/** Legacy Smart Layout is a resize rule, not a declaration of flex-flow order. */
export function smartLayoutPlan(source: Sketch): Plan {
  const gl = source.groupLayout;
  if (![0, 1].includes(gl?.axis) || ![0, 1, 2].includes(gl?.layoutAnchor))
    return { reason: "Unrecognized legacy Smart Layout direction or anchor." };
  const horizontal = gl.axis === 0;
  const axis = horizontal ? "x" : "y";
  const size = horizontal ? "width" : "height";
  const cross = horizontal ? "y" : "x";
  const crossSize = horizontal ? "height" : "width";
  const parent = source.frame;
  const children: Sketch[] = (source.layers ?? []).filter(
    (child: Sketch) => child.isVisible !== false,
  );
  if (!parent || !children.length)
    return { reason: "No visible linear content to translate to Auto Layout." };
  for (const child of children) {
    const f = child.frame;
    if (
      !f ||
      ![f.x, f.y, f.width, f.height].every(Number.isFinite) ||
      f.width <= 0 ||
      f.height <= 0 ||
      child.rotation ||
      child.isFlippedHorizontal ||
      child.isFlippedVertical ||
      child.flexItem?.ignoreLayout ||
      child.bridge?.ignoresStackLayout
    )
      return {
        reason:
          "Transformed, excluded or degenerate children need their source positions.",
      };
    if (
      f.x < -1e-6 ||
      f.y < -1e-6 ||
      f.x + f.width > parent.width + 1e-6 ||
      f.y + f.height > parent.height + 1e-6
    )
      return { reason: "Children extend outside the source container." };
  }
  const order = [...children].sort((a, b) => a.frame[axis] - b.frame[axis]);
  const gaps = order
    .slice(1)
    .map(
      (child, i) =>
        child.frame[axis] - order[i].frame[axis] - order[i].frame[size],
    );
  if (gaps.some((gap) => gap < -1e-6))
    return {
      reason:
        "Overlapping children cannot be represented as linear Auto Layout flow.",
    };
  const gap = gaps[0] ?? 0;
  if (gaps.some((value) => !close(value, gap)))
    return {
      reason:
        "Unequal source gaps cannot be represented by one Auto Layout spacing value.",
    };
  const starts = order.map((child) => child.frame[cross]);
  const ends = order.map(
    (child) => child.frame[cross] + child.frame[crossSize],
  );
  const centers = order.map((child, i) => (starts[i] + ends[i]) / 2);
  const crossAlignment: Alignment | undefined = starts.every((value) =>
    close(value, starts[0]),
  )
    ? "MIN"
    : centers.every((value) => close(value, centers[0]))
      ? "CENTER"
      : ends.every((value) => close(value, ends[0]))
        ? "MAX"
        : undefined;
  if (!crossAlignment)
    return {
      reason:
        "Independent cross-axis positions cannot share one Auto Layout alignment.",
    };
  const ids = children.map(sourceId);
  const sortedIds = order.map(sourceId);
  const sameOrder = ids.every((id, i) => id === sortedIds[i]);
  const reverseOrder = ids.every(
    (id, i) => id === sortedIds[ids.length - 1 - i],
  );
  if (!sameOrder && !reverseOrder)
    return {
      reason: "Source paint order cannot be preserved by this linear flow.",
    };
  const first = order[0].frame;
  const last = order[order.length - 1].frame;
  const near = starts.reduce((a, b) => Math.min(a, b), Infinity);
  const far = ends.reduce((a, b) => Math.max(a, b), -Infinity);
  const padding = {
    top: horizontal ? near : first.y,
    right: horizontal ? parent.width - last.x - last.width : parent.width - far,
    bottom: horizontal
      ? parent.height - far
      : parent.height - last.y - last.height,
    left: horizontal ? first.x : near,
  };
  // Only remove floating-point noise at zero; unsupported geometry takes the freeform path.
  for (const key of ["top", "right", "bottom", "left"] as const)
    if (close(padding[key], 0)) padding[key] = 0;
  return {
    direction: horizontal ? "HORIZONTAL" : "VERTICAL",
    order,
    gap: close(gap, 0) ? 0 : gap,
    crossAlignment,
    reverseZ: !sameOrder,
    padding,
  };
}

export async function applySmartLayout(
  ctx: ImportContext,
  source: Sketch,
  node: LayoutNode,
): Promise<void> {
  let plan = smartLayoutPlan(source);
  if (!("reason" in plan)) {
    const children = plan.order;
    const targets = children.map((child) => ctx.nodes.get(sourceId(child)));
    const sourceIds = new Set((source.layers ?? []).map(sourceId));
    if (
      targets.some(
        (child, i) =>
          !child ||
          child.parent?.id !== node.id ||
          child.type === "VECTOR" ||
          // Permit native float storage noise, not intrinsic text-size changes.
          Math.abs(child.width - children[i].frame.width) > 1e-4 ||
          Math.abs(child.height - children[i].frame.height) > 1e-4,
      ) ||
      node.children.some(
        (child) => !sourceIds.has(child.getPluginData("sketch2figma:sourceId")),
      )
    )
      plan = {
        reason:
          "Source child geometry or native wrappers require freeform positioning.",
      };
  }
  if ("reason" in plan) {
    const affixPlan = smartLayoutAffixPlan(source);
    let affixMapped = false;
    if (affixPlan) {
      const label = ctx.nodes.get(sourceId(affixPlan.label));
      const affix = ctx.nodes.get(sourceId(affixPlan.affix));
      if (
        label?.parent?.id === node.id &&
        affix?.parent?.id === node.id &&
        affix.type === "INSTANCE" &&
        "constraints" in label &&
        "constraints" in affix
      ) {
        await ctx.journal.before(label);
        await ctx.journal.before(affix);
        affixMapped = await ctx.attempt(source, "/groupLayout", () => {
          label.constraints = { horizontal: "MIN", vertical: "CENTER" };
          affix.constraints = { horizontal: "MAX", vertical: "CENTER" };
        });
        if (affixMapped)
          ctx.finding(
            "SMART_LAYOUT_AFFIX",
            "Legacy auto-width label and trailing Symbol retain their left/right insets and fixed icon dimensions when an instance resizes. Source frames and background constraints remain intact.",
            source,
            "/groupLayout",
            "info",
          );
      }
    }
    const reason = `${plan.reason} Editable source geometry and paint order retained; ${
      affixMapped
        ? "label and trailing Symbol insets use native resize constraints. Other legacy responsive behavior is not reproduced."
        : "source constraints retained. Legacy responsive behavior is not reproduced."
    }`;
    await ctx.attempt(
      source,
      "/groupLayout",
      () => {
        node.layoutMode = "NONE";
      },
      ["_class", "axis", "layoutAnchor"],
      "Partial",
      reason,
    );
    ctx.finding("SMART_LAYOUT_GEOMETRY", reason, source, "/groupLayout");
    return;
  }
  const native = plan;
  const originalTransforms = node.children.map((child) => ({
    child,
    transform: child.relativeTransform,
  }));
  const hidden = originalTransforms.filter(({ child }) => !child.visible);
  const reason =
    "Legacy Smart Layout represented by measured linear Auto Layout; source spacing, positions and paint order preserved. Dynamic Sketch resize behavior may differ.";
  const accepted = await ctx.attempt(
    source,
    "/groupLayout",
    () => {
      node.layoutMode = native.direction;
      node.primaryAxisSizingMode = "FIXED";
      node.counterAxisSizingMode = "FIXED";
      node.layoutWrap = "NO_WRAP";
      node.itemSpacing = native.gap;
      node.primaryAxisAlignItems = (["MIN", "CENTER", "MAX"] as const)[
        source.groupLayout.layoutAnchor
      ];
      node.counterAxisAlignItems = native.crossAlignment;
      node.itemReverseZIndex = native.reverseZ;
      node.paddingTop = native.padding.top;
      node.paddingRight = native.padding.right;
      node.paddingBottom = native.padding.bottom;
      node.paddingLeft = native.padding.left;
      native.order.forEach((child, i) =>
        node.insertChild(i, ctx.nodes.get(sourceId(child))!),
      );
      for (const { child, transform } of hidden) {
        if ("layoutPositioning" in child) child.layoutPositioning = "ABSOLUTE";
        child.relativeTransform = transform;
      }
      node.resize(source.frame.width, source.frame.height);
    },
    ["_class", "axis", "layoutAnchor"],
    "Partial",
    reason,
  );
  if (accepted)
    ctx.finding("SMART_LAYOUT_APPROXIMATION", reason, source, "/groupLayout");
  else {
    const fallback =
      "Figma rejected the measured Smart Layout mapping. Editable source positions retained in a freeform frame.";
    await ctx.attempt(
      source,
      "/groupLayout",
      () => {
        node.layoutMode = "NONE";
        node.resize(source.frame.width, source.frame.height);
        originalTransforms.forEach(({ child }, i) =>
          node.insertChild(i, child),
        );
        for (const { child, transform } of originalTransforms)
          child.relativeTransform = transform;
      },
      ["_class", "axis", "layoutAnchor"],
      "Partial",
      fallback,
    );
    ctx.finding("SMART_LAYOUT_GEOMETRY", fallback, source, "/groupLayout");
  }
}
