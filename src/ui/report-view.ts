import type { ImportSummary } from "./plugin-messages";
import { focusedReport, type ReportIssue } from "./report-model";
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
function value(v: unknown): string {
  if (v === undefined) return "Not recorded";
  if (v === null || v === "") return "None";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "Could not display value";
  }
}
function shortIssue(check: NonNullable<ReportIssue["check"]>): string {
  if (check.passed === null) return "Could not verify";
  const descriptions: Record<string, string> = {
    "layer-exists": "Symbol was not imported",
    hierarchy: "Symbol hierarchy differs",
    "style-binding": "Source style is not fully linked",
    "instance-text-style-binding": "Text style is not fully linked",
    "variable-binding": "Color variable link differs",
    "token-binding": "Token link differs",
    "component-link": "Source symbol is not linked",
    "component-override": "Symbol override differs",
    "component-layout": "Symbol layout differs",
    "component-layout-binding": "Inherited token link differs",
  };
  return Object.prototype.hasOwnProperty.call(descriptions, check.kind ?? "")
    ? descriptions[check.kind!]
    : "Source and Figma values differ";
}
export function renderReport(
  container: HTMLElement,
  report: ImportSummary,
  select: (id: string) => void,
): void {
  const section = element("section"),
    model = focusedReport(report);
  section.className = "file-report";
  section.append(
    element("h3", report.file ?? "Imported document"),
    element(
      "p",
      `${model.issueCount} issue${model.issueCount === 1 ? "" : "s"}`,
    ),
  );
  const layers = new Map((report.layers ?? []).map((l) => [l.sourceId, l]));
  const renderGroup = (title: string, issues: ReportIssue[], checks = 0) => {
    const group = element("details"),
      summary = element("summary"),
      count = element("span", String(issues.length));
    group.className = "check-group";
    count.className = "check-count";
    summary.append(element("span", title), count);
    group.append(summary);
    if (!issues.length) {
      const empty = element(
        "p",
        checks ? "No issues recorded" : "No checks recorded",
      );
      empty.className = "check-empty";
      group.append(empty);
    } else {
      const list = element("ol");
      for (const issue of issues) {
        const row = element("li"),
          layer = issue.sourceId ? layers.get(issue.sourceId) : undefined;
        const actual = issue.check?.actual as { targetId?: unknown } | null;
        const targetId =
          actual && typeof actual.targetId === "string"
            ? actual.targetId
            : layer?.targetId;
        const name = layer?.name ?? issue.sourceId;
        if (name && targetId) {
          const link = element("button", name);
          link.className = "report-layer";
          link.title = "Show this layer in Figma";
          link.setAttribute("aria-label", `Show ${name} in Figma`);
          link.onclick = () => select(targetId);
          row.append(link);
        } else if (name) row.append(element("strong", name));
        row.append(
          element(
            "p",
            issue.check ? shortIssue(issue.check) : issue.finding!.message,
          ),
        );
        if (issue.check) {
          const values = element("details");
          values.className = "check-values";
          values.append(
            element("summary", "Details"),
            element("p", issue.check.message ?? "Validation failed."),
            element(
              "pre",
              `Expected:\n${value(issue.check.expected)}\n\nActual:\n${value(issue.check.actual)}`,
            ),
          );
          for (const note of issue.notes)
            values.append(element("p", note.message));
          row.append(values);
        }
        list.append(row);
      }
      group.append(list);
    }
    section.append(group);
  };
  for (const group of model.groups)
    renderGroup(group.label, group.issues, group.checks);
  if (model.errors.length) renderGroup("Import errors", model.errors);
  container.append(section);
}
