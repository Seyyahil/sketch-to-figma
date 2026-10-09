import type {
  ConversionReport,
  Validation,
  Finding,
  LayerAudit,
} from "../core/types";

/** The panel consumes this validated subset of the full conversion audit. */
export type ImportSummary = {
  state: Exclude<ConversionReport["state"], "running">;
  totals: Pick<ConversionReport["totals"], "Partial" | "Unsupported">;
  file?: string;
  documentId?: string;
  layers?: (Pick<LayerAudit, "sourceId" | "name" | "targetId"> &
    Partial<Pick<LayerAudit, "sourceType">>)[];
  validations: (Pick<Validation, "passed"> &
    Partial<Omit<Validation, "passed">>)[];
  findings: (Pick<Finding, "severity" | "message"> &
    Partial<Omit<Finding, "severity" | "message">>)[];
};
type PluginMessage =
  | { type: "ready"; fonts: FontName[]; hasReport?: boolean }
  | { type: "progress"; requestId: string; done: number }
  | { type: "report"; requestId: string; report: ImportSummary }
  | { type: "saved-report"; report: ImportSummary }
  | { type: "error"; requestId?: string; message: string };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const requestId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const resourceKind = (value: unknown) =>
  value === undefined ||
  ["colors", "layerStyles", "textStyles", "components", "tokens"].includes(
    value as string,
  );
const fontName = (value: unknown): value is FontName =>
  record(value) &&
  typeof value.family === "string" &&
  typeof value.style === "string";
function summary(value: unknown): value is ImportSummary {
  return (
    record(value) &&
    (value.state === "complete" ||
      value.state === "cancelled" ||
      value.state === "failed") &&
    (value.file === undefined || typeof value.file === "string") &&
    (value.documentId === undefined || typeof value.documentId === "string") &&
    (value.layers === undefined ||
      (Array.isArray(value.layers) &&
        value.layers.every(
          (l) =>
            record(l) &&
            typeof l.sourceId === "string" &&
            typeof l.name === "string" &&
            (l.targetId === undefined || typeof l.targetId === "string") &&
            (l.sourceType === undefined || typeof l.sourceType === "string"),
        ))) &&
    record(value.totals) &&
    count(value.totals.Partial) &&
    count(value.totals.Unsupported) &&
    Array.isArray(value.validations) &&
    value.validations.every(
      (v) =>
        record(v) &&
        resourceKind(v.resource) &&
        (v.passed === true || v.passed === false || v.passed === null) &&
        ["kind", "sourceId", "message"].every(
          (key) => v[key] === undefined || typeof v[key] === "string",
        ),
    ) &&
    Array.isArray(value.findings) &&
    value.findings.every(
      (f) =>
        record(f) &&
        resourceKind(f.resource) &&
        typeof f.message === "string" &&
        ["code", "sourceId", "path"].every(
          (key) => f[key] === undefined || typeof f[key] === "string",
        ) &&
        (f.severity === "info" ||
          f.severity === "warning" ||
          f.severity === "error"),
    )
  );
}
/** Figma relays pluginMessage through host frames; event.source need not be parent. */
export function readPluginMessage(data: unknown): PluginMessage | undefined {
  if (!record(data) || !record(data.pluginMessage)) return;
  const m = data.pluginMessage;
  switch (m.type) {
    case "ready":
      if (Array.isArray(m.fonts) && m.fonts.every(fontName))
        return {
          type: "ready",
          fonts: m.fonts,
          hasReport: m.hasReport === true,
        };
      break;
    case "progress":
      if (requestId(m.requestId) && count(m.done))
        return { type: "progress", requestId: m.requestId, done: m.done };
      break;
    case "report":
      if (requestId(m.requestId) && summary(m.report))
        return { type: "report", requestId: m.requestId, report: m.report };
      break;
    case "saved-report":
      if (summary(m.report)) return { type: "saved-report", report: m.report };
      break;
    case "error":
      if (
        (m.requestId === undefined || requestId(m.requestId)) &&
        typeof m.message === "string"
      )
        return { type: "error", requestId: m.requestId, message: m.message };
  }
}

/** Send inspection details without duplicating the entire per-property source audit into the iframe. */
export function summarizeReport(report: ConversionReport): ImportSummary {
  return {
    file: report.file,
    documentId: report.documentId,
    state: report.state as ImportSummary["state"],
    totals: report.totals,
    validations: report.validations,
    findings: report.findings,
    layers: report.layers.map(({ sourceId, name, targetId, sourceType }) => ({
      sourceId,
      name,
      targetId,
      sourceType,
    })),
  };
}
