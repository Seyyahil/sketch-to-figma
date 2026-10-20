import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import type { ConversionReport } from "../core/types";
import { readData, writeData } from "./storage";
import { encodeHex, decodeHex } from "../core/hex";
import {
  readPluginMessage,
  summarizeReport,
  type ImportSummary,
} from "../ui/plugin-messages";

interface StoredReport {
  encoding: "zlib-hex-v1";
  data: string;
}
const REPORT_FIELDS = ["layers", "findings", "validations"] as const;
type ReportField = (typeof REPORT_FIELDS)[number];
interface RecordReport {
  encoding: "zlib-records-v2";
  bank: 0 | 1;
  header: Omit<ConversionReport, ReportField>;
  counts: Record<ReportField, number>;
}
const RECORD_CHUNK = 256 * 1024;
const partKey = (id: string, bank: number, field: string, part?: number) =>
  `audit-records:${id}:${bank}:${field}${part === undefined ? "" : `:${part}`}`;

function clearData(root: PluginDataMixin, key: string): void {
  const count = Number(root.getPluginData(`sketch2figma:${key}:count`) || 0);
  for (let i = 0; i < count; i++)
    root.setPluginData(`sketch2figma:${key}:${i}`, "");
  root.setPluginData(`sketch2figma:${key}:count`, "");
}

function recordReport(
  root: PluginDataMixin,
  documentId: string,
): RecordReport | null {
  const stored = readData<RecordReport | null>(
    root,
    `audit-v2:${documentId}`,
    null,
  );
  if (
    stored &&
    (stored.encoding !== "zlib-records-v2" ||
      ![0, 1].includes(stored.bank) ||
      stored.header?.documentId !== documentId ||
      REPORT_FIELDS.some(
        (field) =>
          !Number.isSafeInteger(stored.counts?.[field]) ||
          stored.counts[field] < 0,
      ))
  )
    throw new Error("Corrupted conversion audit.");
  return stored;
}

/** Full per-file audits remain recoverable when the panel is reopened. */
export async function writeReport(
  root: PluginDataMixin,
  report: ConversionReport,
): Promise<void> {
  const previous = recordReport(root, report.documentId);
  const bank = previous?.bank === 0 ? 1 : 0;
  const inactivePrefix = `sketch2figma:audit-records:${report.documentId}:${bank}:`;
  for (const key of root.getPluginDataKeys())
    if (key.startsWith(inactivePrefix)) root.setPluginData(key, "");
  const { layers, findings, validations, ...header } = report;
  const fields = { layers, findings, validations };
  const counts = { layers: 0, findings: 0, validations: 0 };
  // Never stringify or encode the whole audit. Large imports can have hundreds
  // of megabytes of property ledgers even though the scene imports successfully.
  for (const field of REPORT_FIELDS) {
    let records: string[] = [];
    let size = 0;
    const flush = async () => {
      if (!records.length) return;
      const bytes = zlibSync(strToU8(`[${records.join(",")}]`));
      writeData(
        root,
        partKey(report.documentId, bank, field, counts[field]++),
        encodeHex(bytes),
      );
      records = [];
      size = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    for (const record of fields[field]) {
      const text = JSON.stringify(record);
      if (size + text.length > RECORD_CHUNK) await flush();
      records.push(text);
      size += text.length + 1;
    }
    await flush();
  }
  writeData(
    root,
    partKey(report.documentId, bank, "summary"),
    summarizeReport(report),
  );
  // Switch only after every new record and summary is durable. A failed retry
  // leaves the prior audit readable instead of publishing a partial audit.
  writeData(root, `audit-v2:${report.documentId}`, {
    encoding: "zlib-records-v2",
    bank,
    header,
    counts,
  } satisfies RecordReport);
  writeData(root, "lastReport", report.documentId);
  if (previous) {
    for (const field of REPORT_FIELDS)
      for (let i = 0; i < previous.counts[field]; i++)
        clearData(root, partKey(report.documentId, previous.bank, field, i));
    clearData(root, partKey(report.documentId, previous.bank, "summary"));
  }
  clearData(root, `audit:${report.documentId}`);
  clearData(root, `audit-summary:${report.documentId}`);
}

/** Reopening the resource panel does not need to inflate every source-property ledger. */
export function readReportSummary(
  root: PluginDataMixin,
  documentId: string,
): ImportSummary | null {
  const current = recordReport(root, documentId);
  const cached = readData<unknown>(
    root,
    current
      ? partKey(documentId, current.bank, "summary")
      : `audit-summary:${documentId}`,
    null,
  );
  if (current && cached === null)
    throw new Error("Corrupted conversion report summary.");
  if (cached !== null) {
    const message = readPluginMessage({
      pluginMessage: { type: "saved-report", report: cached },
    });
    if (
      message?.type !== "saved-report" ||
      message.report.documentId !== documentId
    )
      throw new Error("Corrupted conversion report summary.");
    return message.report;
  }
  const full = readReport(root, documentId);
  if (!full) return null;
  const summary = summarizeReport(full);
  // Legacy audits migrate once; the complete compressed audit stays unchanged.
  writeData(root, `audit-summary:${documentId}`, summary);
  return summary;
}
export function readReport(
  root: PluginDataMixin,
  documentId: string,
): ConversionReport | null {
  const current = recordReport(root, documentId);
  if (current) {
    const result: ConversionReport = {
      ...current.header,
      layers: [],
      findings: [],
      validations: [],
    };
    try {
      for (const field of REPORT_FIELDS)
        for (let i = 0; i < current.counts[field]; i++) {
          const data = readData<string | null>(
            root,
            partKey(documentId, current.bank, field, i),
            null,
          );
          if (typeof data !== "string" || !data.length) throw new Error();
          const records = JSON.parse(strFromU8(unzlibSync(decodeHex(data))));
          if (!Array.isArray(records) || !records.length) throw new Error();
          for (const record of records) result[field].push(record);
        }
      return result;
    } catch {
      throw new Error("Corrupted conversion audit.");
    }
  }
  const stored = readData<StoredReport | null>(
    root,
    `audit:${documentId}`,
    null,
  );
  if (!stored) return null;
  if (
    stored.encoding !== "zlib-hex-v1" ||
    typeof stored.data !== "string" ||
    !stored.data.length
  )
    throw new Error("Corrupted conversion audit.");
  try {
    const bytes = decodeHex(stored.data);
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
    const match = key.match(/^sketch2figma:audit(?:-v2)?:(.+):count$/);
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
