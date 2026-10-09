import { expect, it } from "vitest";
import { focusedReport } from "../src/ui/report-model";
import type { ImportSummary } from "../src/ui/plugin-messages";

const report = (data: Partial<ImportSummary> = {}): ImportSummary => ({
  state: "complete",
  totals: { Partial: 100, Unsupported: 10 },
  validations: [],
  findings: [],
  ...data,
});
it("classifies original text links separately from effects on the same text layer", () => {
  const model = focusedReport(
    report({
      layers: [{ sourceId: "T", name: "Body", sourceType: "text" }],
      validations: [
        { kind: "style-binding", sourceId: "T", passed: false },
        {
          kind: "style-binding",
          resource: "layerStyles",
          sourceId: "T",
          passed: false,
        },
        { kind: "instance-text-style-binding", sourceId: "I", passed: false },
      ],
    }),
  );
  expect(model.groups.map((g) => g.issues.length)).toEqual([0, 1, 2, 0, 0]);
  expect(model.issueCount).toBe(3);
});
it("classifies older saved style readbacks when explicit category metadata is absent", () => {
  const model = focusedReport(
    report({
      validations: [
        {
          kind: "style-binding",
          passed: false,
          message: "Title: textStyleId is not fully bound.",
        },
        {
          kind: "style-binding",
          passed: false,
          message: "Shape: effectStyleId is not fully bound.",
        },
      ],
    }),
  );
  expect(model.groups.map((g) => g.issues.length)).toEqual([0, 1, 1, 0, 0]);
});
it("excludes all geometry even when tagged as a resource failure", () => {
  const raw = report({
    validations: [
      {
        kind: "geometry",
        resource: "components",
        passed: false,
        actual: { width: 1000 },
      },
      { kind: "transform", passed: false, actual: { delta: { x: 100 } } },
      { kind: "boolean-geometry", passed: null },
    ],
    findings: [
      {
        code: "GEOMETRY_DIFFERENCE",
        resource: "components",
        severity: "error",
        message: "Size",
      },
      { code: "TRANSFORM_DIFFERENCE", severity: "warning", message: "Flip" },
    ],
  });
  const before = JSON.stringify(raw);
  const model = focusedReport(raw);
  expect(model.issueCount).toBe(0);
  expect(model.groups.every((g) => g.checks === 0)).toBe(true);
  expect(JSON.stringify(raw)).toBe(before);
});
it("counts failed and unverified resources without calling them all failures", () => {
  const model = focusedReport(
    report({
      validations: [
        { kind: "token-binding", passed: null },
        { kind: "token-binding", passed: false },
        { kind: "token-binding", passed: true },
      ],
    }),
  );
  expect(model.groups[4].checks).toBe(3);
  expect(model.groups[4].issues.map((i) => i.check!.passed)).toEqual([
    null,
    false,
  ]);
  expect(model.issueCount).toBe(2);
});
it("attaches instance override notes to their actual text target without double-counting", () => {
  const model = focusedReport(
    report({
      validations: [
        {
          kind: "instance-text-style-binding",
          sourceId: "I",
          passed: false,
          actual: { targetId: "2:1" },
        },
        {
          kind: "instance-text-style-binding",
          sourceId: "I",
          passed: false,
          actual: { targetId: "2:2" },
        },
      ],
      findings: [
        {
          code: "TEXT_STYLE_OVERRIDE",
          sourceId: "I",
          path: "/text/2:2/range",
          severity: "warning",
          message: "Line height override",
        },
        {
          code: "INSTANCE_TEXT_STYLE_BINDING",
          sourceId: "I",
          severity: "warning",
          message: "Unbound range",
        },
        {
          code: "TEXT_STYLE_OVERRIDE",
          sourceId: "I",
          path: "/text/2:3/range",
          severity: "warning",
          message: "Separate target",
        },
      ],
    }),
  );
  const issues = model.groups[2].issues;
  expect(issues[0].notes.map((f) => f.message)).toEqual(["Unbound range"]);
  expect(issues[1].notes.map((f) => f.message)).toEqual([
    "Line height override",
  ]);
  expect(issues[2].finding!.message).toBe("Separate target");
  expect(model.issueCount).toBe(3);
});
it("keeps token collection failures under Tokens and independent variable failures under Color variables", () => {
  const model = focusedReport(
    report({
      findings: [
        {
          code: "VARIABLE_MODE_LIMIT",
          path: "tokens:Theme",
          severity: "error",
          message: "Mode limit",
        },
        {
          code: "RESOURCE_CONFLICT",
          path: "tokens:Theme:Spacing",
          severity: "warning",
          message: "Local token retained",
        },
        {
          code: "VARIABLE_FAILURE",
          severity: "error",
          message: "Color failed",
        },
        {
          code: "RESOURCE_CONFLICT",
          path: "text:Body",
          severity: "warning",
          message: "Local style retained",
        },
      ],
    }),
  );
  expect(model.groups.map((g) => g.issues.length)).toEqual([1, 0, 1, 0, 2]);
});
it("ignores unrelated checks safely and preserves fatal import errors", () => {
  const model = focusedReport(
    report({
      validations: [
        { kind: "constructor", passed: false },
        { kind: "__proto__", passed: null },
        { kind: "text-content", passed: false },
        { kind: "prototype", passed: false },
      ],
      findings: [
        { code: "constructor", severity: "warning", message: "Unrelated" },
        {
          code: "IMPORT_FAILURE",
          severity: "error",
          message: "Import interrupted",
        },
      ],
    }),
  );
  expect(model.issueCount).toBe(1);
  expect(model.errors[0].finding!.message).toBe("Import interrupted");
});
it("keeps missing symbol mappings and hierarchy in the Symbols group", () => {
  const model = focusedReport(
    report({
      layers: [
        { sourceId: "S", name: "Button", sourceType: "symbolMaster" },
        { sourceId: "R", name: "Rectangle", sourceType: "rectangle" },
      ],
      validations: [
        { kind: "layer-exists", sourceId: "S", passed: false },
        { kind: "hierarchy", sourceId: "S", passed: false },
        { kind: "layer-exists", sourceId: "R", passed: false },
      ],
    }),
  );
  expect(model.groups[3].issues).toHaveLength(2);
  expect(model.issueCount).toBe(2);
});

it("keeps effect binding notes on a text layer in Layer styles without duplicating them", () => {
  const model = focusedReport(
    report({
      layers: [{ sourceId: "T", name: "Body", sourceType: "text" }],
      validations: [
        {
          kind: "style-binding",
          resource: "layerStyles",
          sourceId: "T",
          passed: false,
          message: "effectStyleId differs",
        },
      ],
      findings: [
        {
          code: "STYLE_BINDING_DIFFERENCE",
          sourceId: "T",
          severity: "warning",
          message: "effectStyleId lost its binding",
        },
      ],
    }),
  );
  expect(model.groups.map((g) => g.issues.length)).toEqual([0, 1, 0, 0, 0]);
  expect(model.groups[1].issues[0].notes).toHaveLength(1);
  expect(model.issueCount).toBe(1);
});
