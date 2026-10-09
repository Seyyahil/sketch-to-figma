import type { Asset, Sketch } from "../core/types";
import type { ImportContext } from "./context";
import { writeData } from "./storage";
export function tiledAsset(
  ctx: ImportContext,
  reference: Sketch,
): Asset | undefined {
  return ctx.file.assets.find(
    (a) =>
      a.tiles &&
      (a.path === reference?._ref || a.path.startsWith(`${reference?._ref}.`)),
  );
}
export async function applyTiledBitmap(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
): Promise<boolean> {
  const asset = tiledAsset(ctx, s.image);
  if (!asset?.tiles) {
    if ("children" in node)
      for (const child of node.children)
        if (
          child.getPluginData("sketch2figma:tile") ||
          child.getPluginData("sketch2figma:wrapper") === "bitmap-paints"
        ) {
          await ctx.journal.before(child);
          child.visible = false;
          ctx.cleanup.add(child);
        }
    return false;
  }
  if (node.type !== "FRAME") {
    ctx.finding(
      "IMAGE_TILE_TARGET",
      "Oversized raster requires an editable frame with image tiles.",
      s,
      "/image",
      "error",
    );
    return false;
  }
  const image = asset.tiles,
    scale = Math.max(node.width / image.width, node.height / image.height),
    x = (node.width - image.width * scale) / 2,
    y = (node.height - image.height * scale) / 2;
  const used = new Set<SceneNode>();
  for (const [i, tile] of image.items.entries()) {
    let rectangle = node.children.find(
      (c) =>
        c.type === "RECTANGLE" &&
        c.getPluginData("sketch2figma:tile") === tile.path,
    ) as RectangleNode | undefined;
    if (rectangle) await ctx.journal.before(rectangle);
    else {
      rectangle = ctx.api.createRectangle();
      ctx.journal.track(rectangle);
      rectangle.setPluginData("sketch2figma:tile", tile.path);
      node.appendChild(rectangle);
    }
    const bytes = ctx.file.assets.find((a) => a.path === tile.path)?.bytes;
    if (!bytes)
      throw new Error(`Missing original-resolution tile ${tile.path}`);
    let hash = ctx.index.assets[tile.path];
    if (!hash) {
      hash = ctx.api.createImage(bytes).hash;
      ctx.index.assets[tile.path] = hash;
    }
    node.insertChild(i, rectangle);
    rectangle.name = `Image tile ${i + 1}`;
    const tx = x + tile.x * scale,
      ty = y + tile.y * scale;
    const tw = tile.width * scale,
      th = tile.height * scale;
    const left = Math.max(0, tx),
      top = Math.max(0, ty);
    const right = Math.min(node.width, tx + tw),
      bottom = Math.min(node.height, ty + th);
    const width = Math.max(0, right - left),
      height = Math.max(0, bottom - top);
    // Clip each image paint instead of the frame: Figma terminates an outer
    // mask chain at a frame with clipsContent=true. Original tile pixels remain.
    rectangle.fills = [
      {
        type: "IMAGE",
        imageHash: hash,
        scaleMode: "CROP",
        imageTransform: [
          [width / tw, 0, (left - tx) / tw],
          [0, height / th, (top - ty) / th],
        ],
      },
    ];
    rectangle.strokes = [];
    rectangle.resize(Math.max(0.01, width), Math.max(0.01, height));
    rectangle.x = left;
    rectangle.y = top;
    rectangle.visible = width > 0 && height > 0;
    rectangle.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    used.add(rectangle);
  }
  const paints = node.fills;
  let overlay = node.children.find(
    (c) => c.getPluginData("sketch2figma:wrapper") === "bitmap-paints",
  ) as RectangleNode | undefined;
  if (typeof paints !== "symbol" && paints.length) {
    if (overlay) await ctx.journal.before(overlay);
    else {
      overlay = ctx.api.createRectangle();
      ctx.journal.track(overlay);
      overlay.setPluginData("sketch2figma:wrapper", "bitmap-paints");
      node.appendChild(overlay);
    }
    node.appendChild(overlay);
    overlay.name = "Bitmap paints";
    overlay.resize(node.width, node.height);
    overlay.x = overlay.y = 0;
    overlay.fills = paints;
    overlay.strokes = [];
    overlay.visible = true;
    overlay.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
    used.add(overlay);
  }
  for (const child of node.children)
    if (
      (child.getPluginData("sketch2figma:tile") ||
        child.getPluginData("sketch2figma:wrapper") === "bitmap-paints") &&
      !used.has(child)
    ) {
      await ctx.journal.before(child);
      child.visible = false;
      ctx.cleanup.add(child);
    }
  node.fills = [];
  node.clipsContent = false;
  writeData(node, "imageTiles", {
    source: asset.path,
    originalByteLength: asset.originalByteLength ?? asset.bytes.length,
    width: image.width,
    height: image.height,
    tiles: image.items,
  });
  ctx
    .ledger(s)
    .fields(
      "/image",
      ["_class", "_ref_class", "_ref"],
      "Editable Equivalent",
      "Source raster split into original-resolution native image tiles to satisfy Figma's 4096px image limit. No pixels downsampled; original asset identity and tile positions retained.",
    );
  ctx.finding(
    "IMAGE_TILED",
    `${asset.path}: ${image.width}×${image.height} preserved as ${image.items.length} editable native raster tiles. Browser decoding converts embedded image color profiles to sRGB; compare with the source render.`,
    s,
    "/image",
    "info",
  );
  return true;
}
