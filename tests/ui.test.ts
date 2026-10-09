import { beforeAll, expect, it } from "vitest";
import { readTestSketch, testSketchPath } from "./private-sketch";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { parseSketch } from "../src/sketch/archive";
import { imageDimensions } from "../src/ui/asset-preparation";
import type { SketchFile } from "../src/core/types";

let code: string, shapes: SketchFile, text: SketchFile;
beforeAll(async () => {
  const result = await build({
    entryPoints: ["src/ui/main.ts"],
    bundle: true,
    write: false,
    format: "iife",
    define: { __WORKER__: '""' },
  });
  code = result.outputFiles[0].text;
  // Worker replies are isolated panel inputs, not native QA import files.
  shapes = {
    name: "shapes.sketch",
    documentId: "SHAPES",
    version: 196,
    digest: "shape-ui-input",
    document: { do_objectID: "SHAPES" },
    meta: { version: 196 },
    user: {},
    assets: [],
    warnings: [],
    pages: [
      {
        _class: "page",
        do_objectID: "P",
        name: "Page",
        layers: [
          {
            _class: "rectangle",
            do_objectID: "R",
            name: "Rectangle",
            frame: { x: 0, y: 0, width: 100, height: 100 },
          },
        ],
      },
    ],
  };
  text = structuredClone(shapes);
  text.name = "text.sketch";
  text.documentId = "TEXT";
  text.pages[0].layers = [
    {
      _class: "text",
      do_objectID: "T",
      name: "Text",
      frame: { x: 0, y: 0, width: 100, height: 20 },
      attributedString: {
        string: "Text",
        attributes: [
          {
            location: 0,
            length: 4,
            attributes: {
              MSAttributedStringFontAttribute: {
                _class: "fontDescriptor",
                attributes: { name: "Arial-Regular", size: 14 },
              },
            },
          },
        ],
      },
    },
  ];
});
class Element {
  attributes = new Set<string>();
  attributeValues = new Map<string, string>();
  children: any[] = [];
  textContent = "";
  className = "";
  title = "";
  hidden = false;
  checked = true;
  files: any[] = [];
  value = "";
  disabled = false;
  classList = { toggle() {} };
  onclick?: () => void;
  onchange?: (event: any) => void;
  append(...children: any[]) {
    this.children.push(...children);
  }
  replaceChildren(...children: any[]) {
    this.children = children;
  }
  setAttribute(key: string, value = "") {
    this.attributes.add(key);
    this.attributeValues.set(key, value);
  }
  getAttribute(key: string) {
    return this.attributeValues.get(key) ?? null;
  }
  removeAttribute(key: string) {
    this.attributes.delete(key);
    this.attributeValues.delete(key);
  }
  hasAttribute(key: string) {
    return this.attributes.has(key);
  }
  toggleAttribute(key: string, value: boolean) {
    value ? this.setAttribute(key) : this.removeAttribute(key);
  }
  click() {
    if (!this.hasAttribute("disabled") && !this.disabled) this.onclick?.();
  }
}
function panel({
  ready = true,
  decodeImage,
}: {
  ready?: boolean;
  decodeImage?: (
    blob: Blob,
  ) => Promise<{ width: number; height: number; close(): void }>;
} = {}) {
  const nodes = new Map<string, Element>(),
    posts: any[] = [],
    reads: any[] = [];
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id)!;
  };
  const window: any = {},
    host = {},
    parent = {
      postMessage(m: any) {
        posts.push(m.pluginMessage);
      },
    };
  const listeners = new Map<string, (event: any) => void>();
  let reader: any;
  class Reader {
    onmessage?: (event: any) => void;
    onerror?: (event: any) => void;
    constructor() {
      reader = this;
    }
    postMessage(m: any) {
      reads.push(m);
    }
    terminate() {}
  }
  runInNewContext(code, {
    window,
    parent,
    document: {
      getElementById: node,
      createElement: (tag: string) =>
        tag === "canvas"
          ? {
              getContext: () => ({ clearRect() {}, drawImage() {} }),
              toBlob: (callback: (blob: Blob) => void) =>
                callback(new Blob(["mock PNG tile"])),
            }
          : new Element(),
      addEventListener(type: string, callback: (event: any) => void) {
        listeners.set(type, callback);
      },
    },
    Worker: Reader,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    Blob,
    setTimeout,
    Uint8Array,
    TextDecoder,
    TextEncoder,
    structuredClone,
    createImageBitmap: decodeImage,
  });
  // Figma can relay messages through a nested host frame, not window.parent.
  const receiveRaw = (data: unknown, source: unknown = host) =>
    window.onmessage({ source, data });
  const receive = (m: unknown, source: unknown = host) =>
    receiveRaw({ pluginMessage: m }, source);
  if (ready) receive({ type: "ready", fonts: [] });
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const add = async (name = "shapes.sketch") => {
    const input = node("files");
    input.files = [{ name, arrayBuffer: async () => new ArrayBuffer(1) }];
    input.onchange?.({ target: input });
    await flush();
    return reads[reads.length - 1];
  };
  const parsed = async (read: any, file = shapes) => {
    reader.onmessage({ data: { id: read.id, file: structuredClone(file) } });
    await flush();
  };
  const imports = () => posts.filter((m) => m.type === "import");
  const drop = async (files: any[]) => {
    listeners.get("drop")!({ preventDefault() {}, dataTransfer: { files } });
    await flush();
  };
  return {
    node,
    posts,
    reads,
    reader,
    receive,
    receiveRaw,
    flush,
    add,
    parsed,
    imports,
    drop,
  };
}
it("sends the actual resource switches while preserving whole-document import and no font fallback", async () => {
  const ui = panel();
  await ui.parsed(await ui.add());
  expect(ui.node("import").hasAttribute("disabled")).toBe(false);
  ui.node("textStyles").checked = ui.node("colors").checked = false;
  ui.node("import").click();
  await ui.flush();
  const request = ui.imports()[0];
  expect(request.file.documentId).toBe(shapes.documentId);
  expect(request.options.resourceTypes).toEqual({
    colors: false,
    layerStyles: true,
    textStyles: false,
    components: true,
    tokens: true,
  });
  expect(request.options.selectedIds).toEqual([]);
  expect(request.options.fallbackFont).toBeUndefined();
  expect(ui.node("drop").hasAttribute("disabled")).toBe(true);
  ui.receive({
    type: "report",
    requestId: request.requestId,
    report: {
      state: "complete",
      totals: { Partial: 3, Unsupported: 2 },
      validations: [{ passed: false }],
      findings: [],
    },
  });
  await ui.flush();
  expect(ui.node("status").textContent).toBe("Imported");
  expect(ui.node("drop").hasAttribute("disabled")).toBe(false);
});
it("blocks missing fonts before making native changes", async () => {
  const ui = panel();
  await ui.parsed(await ui.add("text.sketch"), text);
  ui.node("import").click();
  await ui.flush();
  expect(ui.imports()).toHaveLength(0);
  expect(ui.node("status").textContent).toContain("Missing fonts:");
});
it("deduplicates repeated document IDs and ignores removed worker requests", async () => {
  const ui = panel();
  const first = await ui.add(),
    second = await ui.add();
  await ui.parsed(second);
  await ui.parsed(first);
  expect(ui.node("queue").children).toHaveLength(1);
  const third = await ui.add("third.sketch");
  ui.node("queue").children[1].children.slice(-1)[0].click();
  await ui.parsed(third);
  expect(ui.node("queue").children).toHaveLength(1);
  expect(ui.node("import").hasAttribute("disabled")).toBe(false);
});
it("blocks corrupt token files and recovers after removing them", async () => {
  const ui = panel();
  await ui.parsed(await ui.add());
  await ui.drop([{ name: "tokens.json", text: async () => "{}" }]);
  expect(ui.node("import").hasAttribute("disabled")).toBe(true);
  expect(ui.node("status").textContent).toContain("unique modes");
  ui.node("token-name").children.slice(-1)[0].click();
  expect(ui.node("import").hasAttribute("disabled")).toBe(false);
});
it("cancels the active request and does not start the next batch file", async () => {
  const ui = panel();
  await ui.parsed(await ui.add());
  await ui.parsed(await ui.add("second.sketch"), {
    ...shapes,
    documentId: "second-real-file-identity",
  });
  ui.node("import").click();
  await ui.flush();
  const request = ui.imports()[0];
  ui.node("cancel").click();
  expect(ui.posts[ui.posts.length - 1]).toEqual({ type: "cancel" });
  ui.receive({
    type: "report",
    requestId: request.requestId,
    report: {
      state: "cancelled",
      totals: { Partial: 0, Unsupported: 0 },
      validations: [],
      findings: [],
    },
  });
  await ui.flush();
  expect(ui.imports()).toHaveLength(1);
  expect(ui.node("cancel").hidden).toBe(true);
  expect(ui.node("status").textContent).toContain("Cancelled");
});

it("uses the latest selected source revision for incremental imports, regardless of worker reply order", async () => {
  for (const reverse of [false, true]) {
    const ui = panel(),
      old = await ui.add("old.sketch"),
      latest = await ui.add("latest.sketch");
    const updated = { ...shapes, digest: shapes.digest + "-updated" };
    if (reverse) {
      await ui.parsed(latest, updated);
      await ui.parsed(old);
    } else {
      await ui.parsed(old);
      await ui.parsed(latest, updated);
    }
    expect(ui.node("queue").children).toHaveLength(1);
    ui.node("import").click();
    await ui.flush();
    expect(ui.imports()[0].file.digest).toBe(updated.digest);
  }
});

it.each(["nested host", "null source"])(
  "accepts ready, progress and completion from Figma's %s",
  async (sender) => {
    const ui = panel({ ready: false });
    await ui.parsed(await ui.add());
    expect(ui.node("import").hasAttribute("disabled")).toBe(true);
    const source = sender === "null source" ? null : {};
    ui.receive(
      {
        type: "ready",
        fonts: Array.from({ length: 10010 }, (_, i) => ({
          family: `Font ${i}`,
          style: "Regular",
        })),
      },
      source,
    );
    expect(ui.node("import").hasAttribute("disabled")).toBe(false);
    ui.node("import").click();
    await ui.flush();
    const requestId = ui.imports()[0].requestId;
    ui.receive({ type: "progress", requestId, done: 12 }, source);
    expect(ui.node("status").textContent).toBe("Importing · 12 layers");
    ui.receive(
      {
        type: "report",
        requestId,
        report: {
          state: "complete",
          totals: { Partial: 0, Unsupported: 0 },
          validations: [],
          findings: [],
        },
      },
      source,
    );
    await ui.flush();
    expect(ui.node("status").textContent).toBe("Imported");
    expect(ui.node("cancel").hidden).toBe(true);
    expect(ui.node("import").hasAttribute("disabled")).toBe(false);
  },
);

it("ignores malformed host messages and unrelated request IDs, and accepts the active request's error", async () => {
  const ui = panel({ ready: false });
  await ui.parsed(await ui.add());
  for (const data of [
    null,
    [],
    "ready",
    { type: "ready", fonts: [] },
    { pluginMessage: null },
    { pluginMessage: { type: "ready" } },
    { pluginMessage: { type: "ready", fonts: [null] } },
    {
      pluginMessage: {
        type: "ready",
        fonts: [{ family: 1, style: "Regular" }],
      },
    },
    { pluginMessage: { type: "unknown" } },
  ]) {
    expect(() => ui.receiveRaw(data)).not.toThrow();
    expect(ui.node("import").hasAttribute("disabled")).toBe(true);
  }
  ui.receive({ type: "ready", fonts: [] });
  ui.node("import").click();
  await ui.flush();
  const requestId = ui.imports()[0].requestId;
  ui.receive({ type: "progress", requestId, done: 5 });
  for (const m of [
    { type: "progress", requestId: "stale", done: 20 },
    { type: "progress", requestId, done: "many" },
    { type: "progress", requestId, done: -1 },
    { type: "report", requestId, report: null },
    {
      type: "report",
      requestId,
      report: {
        state: "complete",
        totals: { Partial: 0, Unsupported: 0 },
        validations: [null],
        findings: [],
      },
    },
    {
      type: "report",
      requestId,
      report: {
        state: "complete",
        totals: { Partial: "0", Unsupported: 0 },
        validations: [],
        findings: [],
      },
    },
    { type: "error", requestId, message: null },
    { type: "error", requestId: "stale", message: "Old import failed" },
  ]) {
    expect(() => ui.receive(m)).not.toThrow();
    await ui.flush();
    expect(ui.node("status").textContent).toBe("Importing · 5 layers");
    expect(ui.node("cancel").hidden).toBe(false);
  }
  ui.receive({ type: "error", requestId, message: "Import failed" }, null);
  await ui.flush();
  expect(ui.node("status").textContent).toBe("Import failed");
  expect(ui.node("cancel").hidden).toBe(true);
  expect(ui.node("import").hasAttribute("disabled")).toBe(false);
});

it.skipIf(!testSketchPath)(
  "clears Test.sketch preparation status after its original-resolution images finish preparing",
  async () => {
    const file = await parseSketch(
      new Uint8Array(readTestSketch()),
      "Test.sketch",
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let decodes = 0,
      closed = 0;
    const ui = panel({
      decodeImage: async (blob) => {
        decodes++;
        await gate;
        const size = imageDimensions(new Uint8Array(await blob.arrayBuffer()))!;
        return {
          ...size,
          close() {
            closed++;
          },
        };
      },
    });
    await ui.parsed(await ui.add("Test.sketch"), file);
    expect(decodes).toBe(1);
    expect(ui.node("status").textContent).toBe("Preparing Test.sketch…");
    expect(ui.node("import").hasAttribute("disabled")).toBe(true);
    const bars = descendants(ui.node("queue")).filter(
      (n) => n.className === "file-progress",
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute("aria-label")).toBe("Preparing Test.sketch");
    release();
    await expect
      .poll(() => ui.node("import").hasAttribute("disabled"), { timeout: 5000 })
      .toBe(false);
    expect(decodes).toBe(3);
    expect(closed).toBe(decodes);
    expect(ui.node("status").textContent).toBe("");
    expect(
      descendants(ui.node("queue")).filter(
        (n) => n.className === "file-progress",
      ),
    ).toHaveLength(0);
  },
  30000,
);

function descendants(node: Element): Element[] {
  return [
    node,
    ...node.children.flatMap((child: Element) => descendants(child)),
  ];
}
const failureReport = (count = 372) => ({
  state: "complete",
  file: "Test.sketch",
  documentId: "test-document",
  totals: { Partial: count, Unsupported: 0 },
  findings: [],
  layers: Array.from({ length: count }, (_, i) => ({
    sourceId: `source-${i}`,
    name: `Heading ${i}`,
    sourceType: i % 2 ? "text" : "shapePath",
    targetId: `4:${i}`,
  })),
  validations: Array.from({ length: count }, (_, i) => ({
    kind: i % 2 ? "style-binding" : "geometry",
    sourceId: `source-${i}`,
    passed: false,
    message: `Failure ${i}`,
    expected: { width: 100 },
    actual: { width: 101 },
  })),
});
it("shows resource issues and navigation while excluding geometry from every displayed count", async () => {
  const ui = panel();
  await ui.parsed(await ui.add());
  ui.node("import").click();
  await ui.flush();
  ui.receive({
    type: "report",
    requestId: ui.imports()[0].requestId,
    report: failureReport(),
  });
  await ui.flush();
  expect(ui.node("view-report").textContent).toBe("View import report (186)");
  ui.node("view-report").click();
  expect(ui.node("report-panel").hidden).toBe(false);
  expect(ui.node("import-content").hidden).toBe(true);
  const nodes = descendants(ui.node("report-list"));
  expect(
    nodes.filter((n) => n.textContent.startsWith("Failure ")),
  ).toHaveLength(186);
  expect(nodes.map((n) => n.textContent)).toContain("Heading 371");
  expect(nodes.map((n) => n.textContent)).not.toContain("Dimensions");
  expect(nodes.map((n) => n.textContent)).not.toContain("Heading 0");
  expect(nodes.map((n) => n.textContent)).toContain("Text styles");
  expect(nodes.map((n) => n.textContent)).toContain("186 issues");
  expect(ui.node("status").textContent).toBe("Imported · 186 issues");
  expect(
    nodes
      .filter((n) => n.className === "check-count")
      .map((n) => n.textContent),
  ).toEqual(["0", "0", "186", "0", "0"]);
  expect(ui.node("import-footer").hidden).toBe(true);
  expect(
    nodes.some(
      (n) =>
        n.textContent.includes("Expected:") &&
        n.textContent.includes("100") &&
        n.textContent.includes("Actual:") &&
        n.textContent.includes("101"),
    ),
  ).toBe(true);
  nodes.find((n) => n.className === "report-layer")!.click();
  expect(ui.posts[ui.posts.length - 1]).toEqual({
    type: "select-layer",
    targetId: "4:1",
  });
  ui.node("report-back").click();
  expect(ui.node("import-content").hidden).toBe(false);
  expect(ui.node("import-footer").hidden).toBe(false);
});
it("opens a saved report on request without requiring another import", async () => {
  const ui = panel({ ready: false });
  ui.receive({ type: "ready", fonts: [], hasReport: true });
  expect(ui.node("view-report").textContent).toBe("View saved import report");
  expect(ui.posts.some((p) => p.type === "get-report")).toBe(false);
  ui.node("view-report").click();
  expect(ui.posts[ui.posts.length - 1]).toEqual({ type: "get-report" });
  ui.receive({ type: "saved-report", report: failureReport(2) });
  expect(ui.node("report-panel").hidden).toBe(false);
  expect(
    descendants(ui.node("report-list")).map((n) => n.textContent),
  ).toContain("Heading 1");
  expect(ui.imports()).toHaveLength(0);
});
it("does not display malformed or unrelated reports and recovers from saved-report errors", async () => {
  const ui = panel();
  ui.receive({ type: "ready", fonts: [], hasReport: true });
  ui.receive({ type: "saved-report", report: failureReport(1) });
  expect(ui.node("report-panel").hidden).toBe(true);
  ui.node("view-report").click();
  ui.receive({
    type: "saved-report",
    report: { ...failureReport(1), layers: [{ sourceId: 5, name: "bad" }] },
  });
  expect(ui.node("report-panel").hidden).toBe(true);
  ui.receive({ type: "error", message: "Corrupted conversion audit." });
  expect(ui.node("view-report").disabled).toBe(false);
  expect(ui.node("status").textContent).toBe("Corrupted conversion audit.");
});

it("excludes geometry, transforms and boolean geometry even for large deviations in a saved report", async () => {
  const ui = panel({ ready: false });
  ui.receive({ type: "ready", fonts: [], hasReport: true });
  ui.node("view-report").click();
  ui.receive({
    type: "saved-report",
    report: {
      ...failureReport(0),
      validations: [
        {
          kind: "transform",
          sourceId: "moved",
          passed: false,
          actual: {
            differences: ["y"],
            delta: { y: 100, x: 0, rotationDegrees: 0 },
          },
          message: "Only Y differs.",
        },
        {
          kind: "geometry",
          sourceId: "line",
          passed: false,
          expected: {
            width: 345,
            height: 0,
            basis: "Unstroked path bounds",
            sourceFrame: { width: 345, height: 2 },
          },
          actual: { width: 344, height: 0 },
          message: "Path width differs.",
        },
      ],
    },
  });
  const nodes = descendants(ui.node("report-list"));
  expect(nodes.map((n) => n.textContent)).toContain("0 issues");
  expect(
    nodes.some((n) =>
      /Only Y differs|Path width differs|Dimensions|Position, rotation/.test(
        n.textContent,
      ),
    ),
  ).toBe(false);
  expect(
    nodes
      .filter((n) => n.className === "check-count")
      .map((n) => n.textContent),
  ).toEqual(["0", "0", "0", "0", "0"]);
});
it("excludes unverified geometry without claiming resource checks passed", async () => {
  const ui = panel({ ready: false });
  ui.receive({ type: "ready", fonts: [], hasReport: true });
  ui.node("view-report").click();
  ui.receive({
    type: "saved-report",
    report: {
      ...failureReport(0),
      validations: [
        {
          kind: "geometry",
          sourceId: "bad",
          passed: null,
          message: "Native vector network could not be read.",
        },
        {
          kind: "transform",
          sourceId: "bad",
          passed: null,
          message: "Origin comparison could not run.",
        },
      ],
    },
  });
  const nodes = descendants(ui.node("report-list"));
  expect(nodes.map((n) => n.textContent)).toContain("0 issues");
  expect(
    nodes.filter((n) => n.textContent === "Could not verify"),
  ).toHaveLength(0);
  expect(
    nodes.filter((n) => n.textContent === "No checks recorded"),
  ).toHaveLength(5);
  expect(
    nodes.some((n) =>
      /passed|unchecked|Native vector|Origin comparison/.test(n.textContent),
    ),
  ).toBe(false);
});

it("groups all five resources, keeps unverified bindings and warnings, and exposes fatal import errors", async () => {
  const ui = panel({ ready: false });
  ui.receive({ type: "ready", fonts: [], hasReport: true });
  ui.node("view-report").click();
  ui.receive({
    type: "saved-report",
    report: {
      ...failureReport(0),
      layers: [
        { sourceId: "T", name: "Body", sourceType: "text", targetId: "1:1" },
      ],
      validations: [
        { kind: "variable-binding", passed: false, message: "Missing color" },
        {
          kind: "style-binding",
          resource: "layerStyles",
          passed: false,
          message: "Missing effect",
        },
        {
          kind: "style-binding",
          sourceId: "T",
          passed: false,
          message: "Detached text",
        },
        {
          kind: "instance-text-style-binding",
          sourceId: "I",
          passed: false,
          message: "Detached instance text",
        },
        { kind: "component-link", passed: false, message: "Missing symbol" },
        {
          kind: "component-layout-binding",
          passed: false,
          message: "Missing inherited token",
        },
        {
          kind: "token-binding",
          passed: null,
          message: "Token readback unavailable",
        },
      ],
      findings: [
        {
          code: "STYLE_BINDING_DIFFERENCE",
          sourceId: "T",
          severity: "warning",
          message: "Text style notes",
        },
        {
          code: "TEXT_STYLE_OVERRIDE",
          sourceId: "T",
          severity: "warning",
          message: "Source override cannot bind",
        },
        { code: "TOKEN_ALIAS", severity: "warning", message: "Broken alias" },
        {
          code: "VARIABLE_MODE_LIMIT",
          path: "tokens:Theme",
          severity: "error",
          message: "Unavailable token mode",
        },
        {
          code: "GEOMETRY_UNVERIFIED",
          severity: "error",
          message: "Hidden geometry issue",
        },
        {
          code: "IMPORT_FAILURE",
          severity: "error",
          message: "Import interrupted",
        },
      ],
    },
  });
  const nodes = descendants(ui.node("report-list"));
  expect(
    nodes
      .filter((n) => n.className === "check-group")
      .map((n) => n.children[0].children[0].textContent),
  ).toEqual([
    "Color variables",
    "Layer styles",
    "Text styles",
    "Symbols",
    "Tokens",
    "Import errors",
  ]);
  expect(
    nodes
      .filter((n) => n.className === "check-count")
      .map((n) => n.textContent),
  ).toEqual(["1", "1", "2", "1", "4", "1"]);
  expect(nodes.map((n) => n.textContent)).toContain("10 issues");
  expect(nodes.map((n) => n.textContent)).toContain("Could not verify");
  expect(nodes.map((n) => n.textContent)).toContain(
    "Source override cannot bind",
  );
  expect(nodes.map((n) => n.textContent)).toContain("Import interrupted");
  expect(nodes.map((n) => n.textContent)).not.toContain(
    "Hidden geometry issue",
  );
});
it("rejects invalid resource categories in plugin reports", async () => {
  const ui = panel({ ready: false });
  ui.receive({ type: "ready", fonts: [], hasReport: true });
  ui.node("view-report").click();
  for (const resource of ["geometry", "__proto__", null, {}])
    ui.receive({
      type: "saved-report",
      report: {
        ...failureReport(0),
        validations: [{ kind: "style-binding", resource, passed: false }],
      },
    });
  expect(ui.node("report-panel").hidden).toBe(true);
});

it("shows an indeterminate per-file reading bar until the file is ready", async () => {
  const ui = panel();
  const read = await ui.add("Test.sketch");
  const row = ui.node("queue").children[0];
  const bar = descendants(row).find((n) => n.className === "file-progress")!;
  expect(row.getAttribute("aria-busy")).toBe("true");
  expect(bar.getAttribute("role")).toBe("progressbar");
  expect(bar.getAttribute("aria-label")).toBe("Reading Test.sketch");
  expect(bar.getAttribute("aria-valuenow")).toBeNull();
  expect(descendants(row).map((n) => n.textContent)).toContain("Reading…");
  expect(ui.node("import").hasAttribute("disabled")).toBe(true);
  await ui.parsed(read);
  expect(ui.node("queue").children[0].getAttribute("aria-busy")).toBe("false");
  expect(
    descendants(ui.node("queue")).some((n) => n.className === "file-progress"),
  ).toBe(false);
  expect(ui.node("import").hasAttribute("disabled")).toBe(false);
});
it("clears the reading bar on parse failure and removal, ignoring late reader replies", async () => {
  const ui = panel();
  const bad = await ui.add("broken.sketch");
  ui.reader.onmessage({ data: { id: bad.id, error: "Corrupt archive" } });
  await ui.flush();
  expect(
    descendants(ui.node("queue")).some((n) => n.className === "file-progress"),
  ).toBe(false);
  expect(descendants(ui.node("queue")).map((n) => n.textContent)).toContain(
    "Error",
  );
  expect(ui.node("import").hasAttribute("disabled")).toBe(true);
  ui.node("queue").children[0].children.slice(-1)[0].click();
  const pending = await ui.add("removed.sketch");
  ui.node("queue").children[0].children.slice(-1)[0].click();
  await ui.parsed(pending);
  expect(ui.node("queue").children).toHaveLength(0);
  expect(ui.node("import").hasAttribute("disabled")).toBe(true);
});
it("tracks reading activity independently for each file in a batch", async () => {
  const ui = panel();
  const first = await ui.add("first.sketch");
  await ui.add("second.sketch");
  const bars = () =>
    descendants(ui.node("queue")).filter(
      (n) => n.className === "file-progress",
    );
  expect(bars()).toHaveLength(2);
  await ui.parsed(first);
  expect(bars()).toHaveLength(1);
  expect(bars()[0].getAttribute("aria-label")).toBe("Reading second.sketch");
  expect(ui.node("import").hasAttribute("disabled")).toBe(true);
  ui.reader.onerror({ message: "Reader stopped" });
  await ui.flush();
  expect(bars()).toHaveLength(0);
  expect(ui.node("import").hasAttribute("disabled")).toBe(true);
});
