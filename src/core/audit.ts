import type {
  ConversionReport,
  Fidelity,
  LayerAudit,
  PropertyResult,
  Sketch,
} from "./types";
export const escapePointer = (key: string) =>
  key.replace(/~/g, "~0").replace(/\//g, "~1");
export function leaves(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  const entries = Object.entries(value);
  if (!entries.length) return [prefix];
  return entries.flatMap(([key, child]) =>
    leaves(child, `${prefix}/${escapePointer(key)}`),
  );
}
/** Claims are exact leaf paths. Unknown siblings can never inherit a conversion claim. */
export class Ledger {
  private items = new Map<string, PropertyResult>();
  constructor(
    readonly source: Sketch,
    readonly result: LayerAudit,
  ) {
    for (const path of leaves(source))
      this.items.set(path, {
        path,
        status: "Unsupported",
        reason: "Source property retained; no verified conversion handler.",
      });
  }
  checkpoint(): PropertyResult[] {
    return [...this.items.values()].map((p) => ({ ...p }));
  }
  rollback(items: PropertyResult[]): void {
    this.items = new Map(items.map((p) => [p.path, p]));
  }
  mark(
    path: string,
    status: Fidelity = "Native",
    reason = "Applied through the Figma Plugin API.",
  ): void {
    if (this.items.has(path)) this.items.set(path, { path, status, reason });
  }
  fields(
    prefix: string,
    keys: string[],
    status: Fidelity = "Native",
    reason?: string,
  ): void {
    for (const k of keys)
      this.mark(`${prefix}/${escapePointer(k)}`, status, reason);
  }
  color(prefix: string, status: Fidelity = "Native", reason?: string): void {
    this.fields(
      prefix,
      ["_class", "red", "green", "blue", "alpha"],
      status,
      reason,
    );
  }
  finalize(): LayerAudit {
    this.result.properties = [...this.items.values()];
    return this.result;
  }
}
export function finishReport(report: ConversionReport): ConversionReport {
  const totals: ConversionReport["totals"] = {
    Native: 0,
    "Editable Equivalent": 0,
    "Visual Equivalent": 0,
    Partial: 0,
    Unsupported: 0,
  };
  for (const layer of report.layers)
    if (layer.selected) for (const p of layer.properties) totals[p.status]++;
  report.totals = totals;
  report.finishedAt = new Date().toISOString();
  return report;
}
export function reportMarkdown(r: ConversionReport): string {
  const clean = (s: unknown) =>
    String(s)
      .replace(/\|/g, "\\|")
      .replace(/[\r\n]+/g, " ");
  return (
    `# Conversion audit: ${r.file}\n\nState: ${r.state}. Source version: ${r.sourceVersion}. Visual validation: ${r.visualValidation}.\n\n` +
    `Created ${r.created}, reused ${r.reused}, updated ${r.updated}, preserved local ${r.preserved}.\n\n` +
    Object.entries(r.totals)
      .map(([k, v]) => `- ${k}: ${v} properties`)
      .join("\n") +
    "\n\n## Findings\n\n" +
    r.findings
      .map(
        (f) =>
          `- **${f.severity} · ${f.code}** ${clean(f.message)} (${f.sourceId ?? "document"}${f.path ?? ""})`,
      )
      .join("\n") +
    "\n\n## Validation\n\n" +
    r.validations
      .map(
        (v) =>
          `- ${v.passed === null ? "NOT RUN" : v.passed ? "PASS" : "FAIL"} · ${v.kind}: ${clean(v.message)}`,
      )
      .join("\n") +
    "\n\n## Property coverage\n\n| Source | Property | Classification | Reason |\n|---|---|---|---|\n" +
    r.layers
      .flatMap((l) =>
        l.properties.map(
          (p) =>
            `| ${clean(l.name)} (${l.sourceId})${l.selected ? "" : " [outside scope]"} | ${clean(p.path)} | ${p.status} | ${clean(p.reason)} |`,
        ),
      )
      .join("\n")
  );
}
