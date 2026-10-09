import type { ResourceKind } from "../core/types";
import type { ImportSummary } from "./plugin-messages";

export const REPORT_CATEGORIES: { id: ResourceKind; label: string }[] = [
  { id: "colors", label: "Color variables" },
  { id: "layerStyles", label: "Layer styles" },
  { id: "textStyles", label: "Text styles" },
  { id: "components", label: "Symbols" },
  { id: "tokens", label: "Tokens" },
];
type Check = ImportSummary["validations"][number];
type Finding = ImportSummary["findings"][number];
export type ReportIssue = {
  sourceId?: string;
  check?: Check;
  finding?: Finding;
  notes: Finding[];
};
const checkCategories = new Map<string, ResourceKind>(
  Object.entries({
    "variable-binding": "colors",
    "instance-text-style-binding": "textStyles",
    "component-link": "components",
    "component-override": "components",
    "component-layout": "components",
    "component-layout-binding": "tokens",
    "token-binding": "tokens",
  }),
);
const geometryKinds = new Set(["geometry", "transform", "boolean-geometry"]);
const geometryCodes = new Set([
  "GEOMETRY_DIFFERENCE",
  "GEOMETRY_UNVERIFIED",
  "TRANSFORM_DIFFERENCE",
  "BOOLEAN_DIFFERENCE",
]);
function styleCategory(sourceType?: string, message = ""): ResourceKind {
  if (/effectStyleId/i.test(message)) return "layerStyles";
  return sourceType === "text" ||
    sourceType === "textStyle" ||
    /textStyleId|text style|typography/i.test(message)
    ? "textStyles"
    : "layerStyles";
}
function checkCategory(
  check: Check,
  sourceType?: string,
): ResourceKind | undefined {
  // Geometry never re-enters the focused screen, even with resource metadata.
  if (geometryKinds.has(check.kind ?? "")) return;
  if (check.resource) return check.resource;
  if (check.kind === "style-binding")
    return styleCategory(sourceType, check.message);
  if (
    (check.kind === "layer-exists" || check.kind === "hierarchy") &&
    (sourceType === "symbolMaster" || sourceType === "symbolInstance")
  )
    return "components";
  return checkCategories.get(check.kind ?? "");
}
function findingCategory(
  finding: Finding,
  sourceType?: string,
): ResourceKind | undefined {
  const code = finding.code ?? "",
    path = finding.path ?? "";
  if (geometryCodes.has(code)) return;
  if (finding.resource) return finding.resource;
  if (path.startsWith("tokens:") || code.startsWith("TOKEN_")) return "tokens";
  if (
    code.startsWith("TEXT_STYLE_") ||
    code.startsWith("INSTANCE_TEXT_STYLE_") ||
    code.startsWith("FONT_")
  )
    return "textStyles";
  if (
    code.startsWith("VARIABLE_") ||
    code.startsWith("SWATCH_") ||
    code === "BOUND_PAINT_OPACITY"
  )
    return "colors";
  if (
    code.startsWith("SYMBOL_") ||
    code.startsWith("COMPONENT_") ||
    code.startsWith("OVERRIDE_")
  )
    return "components";
  if (
    code.startsWith("STYLE_") ||
    code === "LOCAL_STYLE_OVERRIDE" ||
    code === "RESOURCE_CONFLICT" ||
    code === "LEGACY_STYLE_RETAINED"
  )
    return styleCategory(
      sourceType,
      path.startsWith("text:") ? "Text Style" : finding.message,
    );
  if (
    path.includes("/sharedStyleID") ||
    path.includes("/textStyle") ||
    sourceType === "sharedStyle"
  )
    return styleCategory(
      sourceType,
      path.startsWith("text:") ? "Text Style" : finding.message,
    );
}
const relatedKinds = new Map<string, string[]>(
  Object.entries({
    STYLE_BINDING_DIFFERENCE: ["style-binding"],
    INSTANCE_TEXT_STYLE_BINDING: ["instance-text-style-binding"],
    TEXT_STYLE_OVERRIDE: ["style-binding", "instance-text-style-binding"],
    TEXT_STYLE_REFERENCE: ["style-binding", "instance-text-style-binding"],
    STYLE_REFERENCE: ["style-binding"],
    VARIABLE_REFERENCE: ["variable-binding"],
  }),
);

/** One model drives the screen, report button and completion count. Full audits stay intact. */
export function focusedReport(report: ImportSummary) {
  const layers = new Map(
    (report.layers ?? []).map((layer) => [layer.sourceId, layer]),
  );
  const groups = REPORT_CATEGORIES.map((category) => ({
    ...category,
    issues: [] as ReportIssue[],
    checks: 0,
  }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  const errors: ReportIssue[] = [];
  for (const check of report.validations) {
    const category = checkCategory(
      check,
      layers.get(check.sourceId ?? "")?.sourceType,
    );
    if (!category) continue;
    const group = byId.get(category)!;
    group.checks++;
    if (check.passed !== true)
      group.issues.push({ sourceId: check.sourceId, check, notes: [] });
  }
  for (const finding of report.findings) {
    if (finding.severity === "info" || geometryCodes.has(finding.code ?? ""))
      continue;
    const category = findingCategory(
      finding,
      layers.get(finding.sourceId ?? "")?.sourceType,
    );
    const group = category ? byId.get(category) : undefined;
    const related = group?.issues.find((issue) => {
      if (
        !finding.sourceId ||
        finding.sourceId !== issue.sourceId ||
        !issue.check ||
        !relatedKinds.get(finding.code ?? "")?.includes(issue.check.kind ?? "")
      )
        return false;
      const actual = issue.check.actual as { targetId?: unknown } | null;
      return (
        finding.code !== "TEXT_STYLE_OVERRIDE" ||
        !actual ||
        typeof actual.targetId !== "string" ||
        !!finding.path?.includes(actual.targetId)
      );
    });
    if (related) {
      related.notes.push(finding);
      continue;
    }
    const issue = { sourceId: finding.sourceId, finding, notes: [] };
    if (group) group.issues.push(issue);
    else if (finding.severity === "error") errors.push(issue);
  }
  return {
    groups,
    errors,
    issueCount: groups.reduce(
      (n, group) => n + group.issues.length,
      errors.length,
    ),
  };
}
