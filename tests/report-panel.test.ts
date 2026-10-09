import { beforeAll, it, expect } from "vitest";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { createHost } from "./mock-figma";
import { bindingFixture } from "./binding-fixture";
import { startImport } from "../src/figma/importer";
import { readIndex, writeData } from "../src/figma/storage";
import { savedReportId } from "../src/figma/report-storage";
let plugin: string;
beforeAll(async () => {
  const r = await build({
    entryPoints: ["src/plugin.ts"],
    bundle: true,
    write: false,
    format: "iife",
  });
  plugin = r.outputFiles[0].text;
});
it("loads existing reports lazily, sends inspection details, and focuses an affected layer", async () => {
  const h = createHost(),
    file = bindingFixture();
  await startImport(h.api, file).result;
  const messages: any[] = [],
    focus: any[] = [];
  const api = h.api as any;
  api.showUI = () => {};
  api.ui = { postMessage: (message: any) => messages.push(message) };
  api.viewport = { scrollAndZoomIntoView: (nodes: any[]) => focus.push(nodes) };
  runInNewContext(plugin, {
    figma: api,
    __html__: "",
    Uint8Array,
    TextEncoder,
    TextDecoder,
    setTimeout,
  });
  await api.ui.onmessage({ type: "ui-ready" });
  expect(messages.map((m) => m.type)).toEqual(["ready"]);
  expect(messages[0].hasReport).toBe(true);
  await api.ui.onmessage({ type: "get-report" });
  const report = messages[messages.length - 1].report;
  expect(report.file).toBe(file.name);
  expect(
    report.validations.some(
      (v: any) => v.passed === false && v.kind === "style-binding",
    ),
  ).toBe(true);
  expect(
    report.layers.every(
      (l: any) => typeof l.name === "string" && !("properties" in l),
    ),
  ).toBe(true);
  const id = readIndex(h.api, file.documentId).nodes.T.nodeId;
  await api.ui.onmessage({ type: "select-layer", targetId: id });
  expect(api.currentPage.selection.map((n: any) => n.id)).toEqual([id]);
  expect(focus[0].map((n: any) => n.id)).toEqual([id]);
  await api.ui.onmessage({ type: "select-layer", targetId: "deleted" });
  expect(messages[messages.length - 1]).toMatchObject({
    type: "error",
    message: expect.stringContaining("no longer available"),
  });
});
it("finds older audits without a last-report pointer, and tolerates a damaged pointer", () => {
  const h = createHost();
  expect(savedReportId(h.api)).toBeUndefined();
  writeData(h.api.root, "audit:legacy", {
    encoding: "zlib-hex-v1",
    data: "00",
  });
  h.api.root.setPluginData("sketch2figma:lastReport:count", "1");
  h.api.root.setPluginData("sketch2figma:lastReport:0", "broken");
  expect(savedReportId(h.api)).toBe("legacy");
  writeData(h.api.root, "audit:current", {
    encoding: "zlib-hex-v1",
    data: "00",
  });
  h.api.currentPage.setPluginData("sketch2figma:documentId", "current");
  expect(savedReportId(h.api)).toBe("current");
});
