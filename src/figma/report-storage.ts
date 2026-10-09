import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import type { ConversionReport } from "../core/types";
import { readData, writeData } from "./storage";

interface StoredReport {
  encoding: "zlib-hex-v1";
  data: string;
}
/** Full per-file audits remain recoverable when the panel is reopened. */
export function writeReport(
  root: PluginDataMixin,
  report: ConversionReport,
): void {
  const bytes = zlibSync(strToU8(JSON.stringify(report)));
  let data = "";
  for (const byte of bytes) data += byte.toString(16).padStart(2, "0");
  writeData(root, `audit:${report.documentId}`, {
    encoding: "zlib-hex-v1",
    data,
  } satisfies StoredReport);
  writeData(root, "lastReport", report.documentId);
}
export function readReport(
  root: PluginDataMixin,
  documentId: string,
): ConversionReport | null {
  const stored = readData<StoredReport | null>(
    root,
    `audit:${documentId}`,
    null,
  );
  if (!stored) return null;
  if (
    stored.encoding !== "zlib-hex-v1" ||
    !/^(?:[\da-f]{2})+$/.test(stored.data)
  )
    throw new Error("Corrupted conversion audit.");
  try {
    const bytes = Uint8Array.from(stored.data.match(/../g)!, (byte) =>
      parseInt(byte, 16),
    );
    return JSON.parse(strFromU8(unzlibSync(bytes))) as ConversionReport;
  } catch {
    throw new Error("Corrupted conversion audit.");
  }
}

/** Resolve an existing audit without decompressing it during plugin startup. */
export function savedReportId(
  api: Pick<PluginAPI, "root" | "currentPage">,
): string | undefined {
  const ids = api.root.getPluginDataKeys().flatMap((key) => {
    const match = key.match(/^sketch2figma:audit:(.+):count$/);
    return match ? [match[1]] : [];
  });
  const pageId = api.currentPage.getPluginData("sketch2figma:documentId");
  if (ids.includes(pageId)) return pageId;
  let last: string | null = null;
  try {
    last = readData<string | null>(api.root, "lastReport", null);
  } catch {
    /* A damaged pointer must not block plugin startup. */
  }
  return last && ids.includes(last) ? last : ids[ids.length - 1];
}
