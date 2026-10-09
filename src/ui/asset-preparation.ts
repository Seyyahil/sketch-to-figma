import type { Asset, SketchFile } from "../core/types";
export function imageDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | undefined {
  if (
    bytes.length > 24 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71
  ) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 4 <= bytes.length) {
      if (bytes[p++] !== 255) continue;
      const marker = bytes[p++];
      if (marker === 255) {
        p--;
        continue;
      }
      if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 217))
        continue;
      const size = (bytes[p] << 8) | bytes[p + 1];
      if (size < 2 || p + size > bytes.length) return;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        size >= 7
      )
        return {
          height: (bytes[p + 3] << 8) | bytes[p + 4],
          width: (bytes[p + 5] << 8) | bytes[p + 6],
        };
      p += size;
    }
  }
}
/** Split existing raster content at native resolution. No design layers are flattened. */
export async function prepareAssets(
  file: SketchFile,
  progress: (message: string) => void,
): Promise<void> {
  for (const asset of [...file.assets]) {
    if (asset.tiles || !asset.path.startsWith("images/")) continue;
    const size = imageDimensions(asset.bytes);
    if (!size || Math.max(size.width, size.height) <= 4096) continue;
    progress(
      `Preparing original-resolution tiles: ${asset.path.split("/").pop()}…`,
    );
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(asset.bytes)]),
    );
    const canvas = document.createElement("canvas"),
      context = canvas.getContext("2d", { colorSpace: "srgb" });
    if (!context) {
      bitmap.close();
      throw new Error("Image tiling requires a canvas renderer.");
    }
    const tiles: NonNullable<Asset["tiles"]>["items"] = [],
      pending: Asset[] = [];
    try {
      for (let y = 0; y < bitmap.height; y += 4096)
        for (let x = 0; x < bitmap.width; x += 4096) {
          const width = Math.min(4096, bitmap.width - x),
            height = Math.min(4096, bitmap.height - y);
          canvas.width = width;
          canvas.height = height;
          context.clearRect(0, 0, width, height);
          context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (b) =>
                b ? resolve(b) : reject(new Error("PNG tile encoding failed.")),
              "image/png",
            ),
          );
          const path = `${asset.path}.tile-${x}-${y}.png`;
          pending.push({
            path,
            bytes: new Uint8Array(await blob.arrayBuffer()),
          });
          tiles.push({ path, x, y, width, height });
          await new Promise((r) => setTimeout(r, 0));
        }
      file.assets.push(...pending);
      asset.tiles = {
        width: bitmap.width,
        height: bitmap.height,
        items: tiles,
      };
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 0;
    }
  }
}
/** Keep the original archive bytes in the UI; send the native host only usable tiles. */
export function nativePayload(file: SketchFile): SketchFile {
  return {
    ...file,
    assets: file.assets.map((a) =>
      a.tiles
        ? { ...a, originalByteLength: a.bytes.length, bytes: new Uint8Array() }
        : a,
    ),
  };
}
