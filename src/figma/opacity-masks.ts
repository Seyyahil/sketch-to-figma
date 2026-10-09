import { sourceId, type Sketch } from "../core/types";
import { paint } from "./appearance";
import type { ImportContext } from "./context";

/** Sketch's progressive opacity is an editable alpha mask, not a raster fallback. */
export async function applyOpacityMask(
  ctx: ImportContext,
  source: Sketch,
  node: SceneNode,
): Promise<void> {
  const settings = source.style?.contextSettings;
  if (!settings?.isProgressive) {
    ctx.ledger(source).mark("/style/contextSettings/isProgressive");
    return;
  }
  if (!settings.gradient) {
    ctx.finding(
      "FADE_GRADIENT",
      "Progressive opacity has no serialized gradient.",
      source,
      "/style/contextSettings",
      "error",
    );
    return;
  }
  const value = await paint(
    ctx,
    source,
    { fillType: 1, gradient: settings.gradient },
    "/style/contextSettings",
    node.width,
    node.height,
  );
  if (!value) return;
  let wrapper =
    node.parent?.type === "FRAME" &&
    node.parent.getPluginData("sketch2figma:fadeFor") === sourceId(source)
      ? node.parent
      : undefined;
  if (!wrapper) {
    const parent = node.parent;
    if (!parent || !("insertChild" in parent))
      throw new Error("Fade target has no mutable parent.");
    await ctx.journal.before(node);
    wrapper = ctx.api.createFrame();
    ctx.journal.track(wrapper);
    wrapper.name = `Opacity mask / ${source.name}`;
    wrapper.fills = [];
    wrapper.clipsContent = false;
    wrapper.resize(Math.max(0.01, node.width), Math.max(0.01, node.height));
    parent.insertChild(parent.children.indexOf(node), wrapper);
    wrapper.relativeTransform = node.relativeTransform;
    if ("constraints" in node) wrapper.constraints = node.constraints;
    wrapper.setPluginData("sketch2figma:wrapper", "opacity-mask");
    wrapper.setPluginData("sketch2figma:fadeFor", sourceId(source));
    wrapper.setPluginData("sketch2figma:documentId", ctx.file.documentId);
    if (
      "layoutMode" in parent &&
      parent.layoutMode !== "NONE" &&
      "layoutPositioning" in node
    ) {
      wrapper.layoutPositioning = node.layoutPositioning;
      wrapper.layoutAlign = node.layoutAlign;
      wrapper.layoutSizingHorizontal = node.layoutSizingHorizontal;
      wrapper.layoutSizingVertical = node.layoutSizingVertical;
    }
    wrapper.appendChild(node);
    node.relativeTransform = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    if ("constraints" in node)
      node.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
  } else await ctx.journal.before(wrapper);
  let mask = wrapper.children.find(
    (c) => c.getPluginData("sketch2figma:wrapper") === "opacity-gradient",
  ) as RectangleNode | undefined;
  if (mask) await ctx.journal.before(mask);
  else {
    mask = ctx.api.createRectangle();
    ctx.journal.track(mask);
    mask.setPluginData("sketch2figma:wrapper", "opacity-gradient");
    wrapper.insertChild(0, mask);
  }
  mask.name = "Opacity gradient";
  mask.resize(Math.max(0.01, wrapper.width), Math.max(0.01, wrapper.height));
  mask.x = mask.y = 0;
  mask.fills = [value];
  mask.strokes = [];
  mask.isMask = true;
  mask.maskType = "ALPHA";
  mask.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
  ctx
    .ledger(source)
    .mark(
      "/style/contextSettings/isProgressive",
      "Editable Equivalent",
      "Progressive opacity reconstructed as a native editable gradient alpha mask. Gradient interpolation requires source-render comparison.",
    );
  ctx.finding(
    "FADE_ALPHA_MASK",
    "Progressive opacity converted to an editable gradient alpha mask; original raster and design layers remain editable.",
    source,
    "/style/contextSettings/isProgressive",
    "info",
  );
}
