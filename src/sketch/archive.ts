import { Inflate, strFromU8 } from "fflate";
import { fingerprint } from "../core/math";
import {
  sourceId,
  walkLayers,
  type Finding,
  type Sketch,
  type SketchFile,
} from "../core/types";
export const LIMITS = {
  archive: 256 * 1024 * 1024,
  expanded: 512 * 1024 * 1024,
  entry: 128 * 1024 * 1024,
  entries: 20000,
  layers: 150000,
  depth: 256,
};
interface ZipEntry {
  name: string;
  size: number;
  compressed: number;
  crc: number;
  method: number;
  localOffset: number;
  flags: number;
  directoryOffset: number;
}
const decoder = new TextDecoder("utf-8", { fatal: true });
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function inspectZip(bytes: Uint8Array): Map<string, ZipEntry> {
  if (bytes.length > LIMITS.archive)
    throw new Error("Archive exceeds 256 MiB safety limit.");
  if (bytes[0] !== 80 || bytes[1] !== 75)
    throw new Error(
      "Not a ZIP-based Sketch document. Pre-43 binary formats require saving with modern Sketch.",
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0)
    throw new Error("Missing ZIP directory: archive may be truncated.");
  const count = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true),
    dirSize = view.getUint32(end + 12, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    count === 65535 ||
    offset === 0xffffffff
  )
    throw new Error("Multi-disk and ZIP64 archives are not supported.");
  if (count > LIMITS.entries || offset + dirSize > end)
    throw new Error("Invalid or oversized ZIP directory.");
  const result = new Map<string, ZipEntry>();
  let p = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || view.getUint32(p, true) !== 0x02014b50)
      throw new Error("Corrupted ZIP directory.");
    const flag = view.getUint16(p + 8, true),
      method = view.getUint16(p + 10, true),
      compressed = view.getUint32(p + 20, true),
      size = view.getUint32(p + 24, true),
      n = view.getUint16(p + 28, true),
      extra = view.getUint16(p + 30, true),
      comment = view.getUint16(p + 32, true);
    if (p + 46 + n + extra + comment > end)
      throw new Error("Truncated ZIP entry.");
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + n));
    if (flag & 1 || ![0, 8].includes(method))
      throw new Error(`Encrypted or unsupported ZIP entry: ${name}`);
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      name.includes("\0") ||
      result.has(name)
    )
      throw new Error(`Unsafe or duplicate archive path: ${name}`);
    total += size;
    if (size > LIMITS.entry || total > LIMITS.expanded)
      throw new Error("Expanded archive exceeds safety limits.");
    result.set(name, {
      name,
      size,
      compressed,
      crc: view.getUint32(p + 16, true),
      method,
      localOffset: view.getUint32(p + 42, true),
      flags: flag,
      directoryOffset: offset,
    });
    p += 46 + n + extra + comment;
  }
  return result;
}
export async function extractZip(
  bytes: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const entries = inspectZip(bytes),
    files = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Sketch uses data descriptors, including for stored image entries. Scanning
  // for ZIP signatures inside payloads can mistake image bytes for a new file.
  // Central-directory sizes delimit each payload, independently of its content.
  const ordered = [...entries.values()].sort(
    (a, b) => a.localOffset - b.localOffset,
  );
  let expanded = 0;
  for (const [i, e] of ordered.entries()) {
    const p = e.localOffset;
    if (p + 30 > bytes.length || view.getUint32(p, true) !== 0x04034b50)
      throw new Error("Invalid local ZIP header.");
    const flags = view.getUint16(p + 6, true),
      method = view.getUint16(p + 8, true),
      n = view.getUint16(p + 26, true),
      extra = view.getUint16(p + 28, true);
    const start = p + 30 + n + extra,
      end = start + e.compressed;
    if (
      flags !== e.flags ||
      method !== e.method ||
      start > bytes.length ||
      end > e.directoryOffset ||
      decoder.decode(bytes.subarray(p + 30, p + 30 + n)) !== e.name
    )
      throw new Error("Local ZIP entries disagree with central directory.");
    if (i + 1 < ordered.length && end > ordered[i + 1].localOffset)
      throw new Error("Overlapping ZIP entries.");
    if (
      !(flags & 8) &&
      (view.getUint32(p + 18, true) !== e.compressed ||
        view.getUint32(p + 22, true) !== e.size)
    )
      throw new Error("Local ZIP sizes disagree with central directory.");
    if (flags & 8) {
      const limit = ordered[i + 1]?.localOffset ?? e.directoryOffset;
      let localZip64 = false;
      for (let q = p + 30 + n; q < start;) {
        if (q + 4 > start) throw new Error("Truncated ZIP extra field.");
        const tag = view.getUint16(q, true),
          size = view.getUint16(q + 2, true);
        if (q + 4 + size > start) throw new Error("Truncated ZIP extra field.");
        if (tag === 1) localZip64 = true;
        q += 4 + size;
      }
      const signed =
          end + 4 <= limit && view.getUint32(end, true) === 0x08074b50,
        descriptor = end + (signed ? 4 : 0),
        length = localZip64 ? 20 : 12;
      if (
        descriptor + length > limit ||
        view.getUint32(descriptor, true) !== e.crc
      )
        throw new Error("Invalid ZIP data descriptor.");
      const compressed = view.getUint32(descriptor + 4, true),
        size = view.getUint32(descriptor + (localZip64 ? 12 : 8), true);
      if (
        compressed !== e.compressed ||
        size !== e.size ||
        (localZip64 &&
          (view.getUint32(descriptor + 8, true) !== 0 ||
            view.getUint32(descriptor + 16, true) !== 0))
      )
        throw new Error("Invalid ZIP data descriptor sizes.");
    }
    const output = new Uint8Array(e.size);
    let at = 0;
    const accept = (data: Uint8Array) => {
      at += data.length;
      expanded += data.length;
      if (at > e.size || expanded > LIMITS.expanded)
        throw new Error(`ZIP expansion limit exceeded: ${e.name}`);
      output.set(data, at - data.length);
    };
    if (method === 0) accept(bytes.subarray(start, end));
    else {
      const inflate = new Inflate((data) => accept(data));
      if (start === end) inflate.push(new Uint8Array(), true);
      for (let pos = start; pos < end; pos += 16384) {
        inflate.push(
          bytes.subarray(pos, Math.min(pos + 16384, end)),
          pos + 16384 >= end,
        );
      }
    }
    if (at !== e.size || crc32(output) !== e.crc)
      throw new Error(`ZIP checksum/length mismatch: ${e.name}`);
    files.set(e.name, output);
    await new Promise((r) => setTimeout(r, 0));
  }
  return files;
}
export async function parseSketch(
  bytes: Uint8Array,
  name: string,
): Promise<SketchFile> {
  const entries = await extractZip(bytes);
  const read = (path: string, required = true): Sketch => {
    const data = entries.get(path);
    if (!data) {
      if (required) throw new Error(`Missing ${path}`);
      return {};
    }
    try {
      const value = JSON.parse(decoder.decode(data));
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("expected object");
      return value;
    } catch (e) {
      throw new Error(`Invalid JSON in ${path}: ${String(e)}`);
    }
  };
  const document = read("document.json"),
    meta = read("meta.json"),
    user = read("user.json", false),
    version = Number(meta.version ?? document.version ?? 0);
  if (!Number.isInteger(version) || version < 43)
    throw new Error(
      `Unsupported or missing Sketch document version: ${version}`,
    );
  if (!Array.isArray(document.pages))
    throw new Error("document.pages must be an array.");
  const warnings: Finding[] = [],
    pages = document.pages.map((p: Sketch) =>
      p._ref ? read(`${p._ref}.json`) : p,
    );
  const seen = new Set<string>();
  let count = 0;
  const validate = (n: Sketch, depth: number) => {
    if (depth > LIMITS.depth || ++count > LIMITS.layers)
      throw new Error("Document layer depth/count exceeds limits.");
    if (
      !n ||
      typeof n !== "object" ||
      typeof n._class !== "string" ||
      !sourceId(n)
    )
      throw new Error("Layer is missing a class or identifier.");
    if (seen.has(sourceId(n)))
      throw new Error(`Duplicate layer ID: ${sourceId(n)}`);
    seen.add(sourceId(n));
    if (n.frame)
      for (const k of ["x", "y", "width", "height"])
        if (typeof n.frame[k] !== "number" || !Number.isFinite(n.frame[k]))
          throw new Error(`Invalid frame.${k}: ${sourceId(n)}`);
    if (n.frame && (n.frame.width < 0 || n.frame.height < 0))
      throw new Error("Negative layer dimensions.");
    if (n.layers !== undefined && !Array.isArray(n.layers))
      throw new Error("Invalid children list.");
    for (const c of n.layers ?? []) validate(c, depth + 1);
  };
  for (const p of pages) validate(p, 0);
  const documentId = String(document.do_objectID ?? meta.documentID ?? "");
  if (!documentId)
    throw new Error(
      "Document has no stable identifier; safe reimport identity cannot be established.",
    );
  if (![123, 144, 182, 196].includes(version))
    warnings.push({
      code: "UNVERIFIED_SOURCE_VERSION",
      severity: "warning",
      message: `Source version ${version} is outside the exercised fixture versions (123, 144, 182, 196). Unknown properties are retained and reported.`,
    });
  const assets = [...entries]
    .filter(([p]) => p.startsWith("images/") || p.startsWith("fonts/"))
    .map(([path, bytes]) => ({ path, bytes }));
  return {
    name,
    documentId,
    version,
    document,
    meta,
    user,
    pages,
    assets,
    digest: fingerprint({ document, pages }),
    warnings,
  };
}
