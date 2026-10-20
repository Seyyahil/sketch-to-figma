import { expect, it, vi } from "vitest";
import { encodeHex, decodeHex } from "../src/core/hex";
import {
  readReport,
  writeReport,
  readReportSummary,
} from "../src/figma/report-storage";
import { readData, writeData } from "../src/figma/storage";
import { createHost } from "./mock-figma";
import { zlibSync, strToU8 } from "fflate";
import type { ConversionReport } from "../src/core/types";

it("encodes every byte and multi-megabyte reports compatibly with the existing hex format", () => {
  for (const length of [0, 256, 4095, 4096, 4097, 2 * 1024 * 1024 + 17]) {
    const bytes = Uint8Array.from({ length }, (_, index) => index % 256);
    const hex = encodeHex(bytes);
    expect(hex).toBe(Buffer.from(bytes).toString("hex"));
    expect(Buffer.from(decodeHex(hex))).toEqual(Buffer.from(bytes));
  }
});

it("rejects odd, uppercase, non-hex and late-corrupted data without silently changing bytes", () => {
  for (const value of [
    "0",
    "ab0",
    "AB",
    "-1",
    "gg",
    "00\n0",
    "\u0100\u0101",
    "ab".repeat(30000) + "az",
  ])
    expect(() => decodeHex(value)).toThrow("Invalid hex data");
});

function report(): ConversionReport {
  return {
    schemaVersion: 1,
    file: "report.sketch",
    documentId: "report",
    sourceVersion: 196,
    startedAt: "2026-10-19T00:00:00.000Z",
    state: "complete",
    layers: [],
    findings: [],
    validations: [],
    totals: {
      Native: 0,
      "Editable Equivalent": 0,
      "Visual Equivalent": 0,
      Partial: 0,
      Unsupported: 0,
    },
    created: 0,
    updated: 0,
    reused: 0,
    preserved: 0,
    visualValidation: "not-run",
    apiVersion: "1.0.0",
    sourceMetadataPreserved: true,
  };
}

it("reads legacy reports byte-for-byte and preserves the full per-property audit on write and reopen", async () => {
  const h = createHost(),
    source = report();
  source.layers = [
    {
      sourceId: "layer",
      name: "Layer",
      sourceType: "text",
      selected: true,
      targetId: "1:1",
      properties: [
        {
          path: "/unmapped",
          status: "Unsupported",
          reason: "Source retained: æ 中文",
        },
      ],
    },
  ];
  const legacy = Buffer.from(
    zlibSync(strToU8(JSON.stringify(source))),
  ).toString("hex");
  writeData(h.api.root, "audit:report", {
    encoding: "zlib-hex-v1",
    data: legacy,
  });
  expect(readReport(h.api.root, "report")).toEqual(source);
  await writeReport(h.api.root, source);
  expect(readData<any>(h.api.root, "audit-v2:report", null).encoding).toBe(
    "zlib-records-v2",
  );
  expect(readData<any>(h.api.root, "audit:report", null)).toBeNull();
  expect(readReport(h.api.root, "report")).toEqual(source);
  expect(readData(h.api.root, "lastReport", "")).toBe("report");
});

it("keeps corrupted stored reports explicit instead of treating them as a successful empty audit", () => {
  const h = createHost();
  for (const data of ["", null, "010", "ffff", "000g", 123]) {
    writeData(h.api.root, "audit:report", { encoding: "zlib-hex-v1", data });
    expect(() => readReport(h.api.root, "report")).toThrow(
      "Corrupted conversion audit",
    );
  }
});

it("opens the summary without loading property-ledger chunks, and migrates legacy reports without changing the full audit", async () => {
  const h = createHost(),
    source = report();
  source.layers = [
    {
      sourceId: "layer",
      name: "Layer",
      sourceType: "text",
      selected: true,
      properties: [
        { path: "/extra", status: "Unsupported", reason: "Preserved" },
      ],
    },
  ];
  await writeReport(h.api.root, source);
  const original = h.api.root.getPluginData.bind(h.api.root);
  h.api.root.getPluginData = (key) => {
    if (
      key.startsWith("sketch2figma:audit:report:") ||
      /audit-records:report:[01]:(layers|findings|validations):/.test(key)
    )
      throw new Error("Full audit must not be read for the panel");
    return original(key);
  };
  expect(readReportSummary(h.api.root, "report")?.layers?.[0]).toEqual({
    sourceId: "layer",
    name: "Layer",
    sourceType: "text",
    targetId: undefined,
  });
  h.api.root.getPluginData = original;
  const legacy = report();
  legacy.documentId = "legacy";
  const data = Buffer.from(zlibSync(strToU8(JSON.stringify(legacy)))).toString(
    "hex",
  );
  writeData(h.api.root, "audit:legacy", { encoding: "zlib-hex-v1", data });
  expect(readReportSummary(h.api.root, "legacy")?.documentId).toBe("legacy");
  expect(readData<any>(h.api.root, "audit:legacy", null).data).toBe(data);
  expect(
    readData<any>(h.api.root, "audit-summary:legacy", null).documentId,
  ).toBe("legacy");
  writeData(h.api.root, "audit-summary:legacy", {
    ...readData<any>(h.api.root, "audit-summary:legacy", null),
    documentId: "wrong",
  });
  expect(() => readReportSummary(h.api.root, "legacy")).toThrow(
    "Corrupted conversion report summary",
  );
});

it("writes repeated large audits without serializing their complete arrays or retaining old banks", async () => {
  const h = createHost(),
    source = report();
  source.layers = Array.from({ length: 40 }, (_, i) => ({
    sourceId: `layer-${i}`,
    name: `Layer ${i}`,
    sourceType: "text",
    selected: true,
    properties: Array.from({ length: 60 }, (_, j) => ({
      path: `/property/${j}`,
      status: "Unsupported" as const,
      reason:
        `Preserved æ 中文 ${i} ${j} ` + "original source detail ".repeat(150),
    })),
  }));
  const stringify = JSON.stringify;
  const spy = vi.spyOn(JSON, "stringify").mockImplementation((value: any) => {
    if (
      value === source ||
      value === source.layers ||
      value === source.findings ||
      value === source.validations
    )
      throw new Error(
        "Whole-report serialization exceeds the native memory budget",
      );
    return stringify(value);
  });
  try {
    for (let run = 0; run < 3; run++) {
      source.updated = run;
      await writeReport(h.api.root, source);
      expect(readReport(h.api.root, "report")).toEqual(source);
      const current = readData<any>(h.api.root, "audit-v2:report", null);
      expect(current.counts.layers).toBeGreaterThan(1);
      expect(
        h.api.root
          .getPluginDataKeys()
          .some((key) =>
            key.startsWith(
              `sketch2figma:audit-records:report:${1 - current.bank}:`,
            ),
          ),
      ).toBe(false);
    }
  } finally {
    spy.mockRestore();
  }
});

it("keeps the committed audit and summary readable after an interrupted record write, then retries cleanly", async () => {
  const h = createHost(),
    source = report();
  await writeReport(h.api.root, source);
  const original = h.api.root.setPluginData.bind(h.api.root);
  h.api.root.setPluginData = (key, value) => {
    if (key.startsWith("sketch2figma:audit-records:report:1:summary:") && value)
      throw new Error("native write failed");
    original(key, value);
  };
  const next = {
    ...source,
    updated: 3,
    findings: [
      {
        code: "SOURCE_REFERENCE",
        severity: "error" as const,
        message: "Still missing",
      },
    ],
  };
  await expect(writeReport(h.api.root, next)).rejects.toThrow(
    "native write failed",
  );
  expect(readReport(h.api.root, "report")).toEqual(source);
  expect(readReportSummary(h.api.root, "report")?.findings).toEqual([]);
  h.api.root.setPluginData = original;
  await writeReport(h.api.root, next);
  expect(readReport(h.api.root, "report")).toEqual(next);
  expect(readReportSummary(h.api.root, "report")?.findings).toEqual(
    next.findings,
  );
  original("sketch2figma:audit-records:report:1:findings:0:0", '"corrupt"');
  expect(() => readReport(h.api.root, "report")).toThrow(
    "Corrupted conversion audit",
  );
});
