import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  sourceId,
  walkLayers,
  type Sketch,
  type SketchFile,
} from "../src/core/types";
import { startImport } from "../src/figma/importer";
import { mapping, readIndex, writeData } from "../src/figma/storage";
import { createHost } from "./mock-figma";

const color = { red: 1, green: 1, blue: 1, alpha: 1 };
const fill = { fillType: 0, isEnabled: true, color };
const options = {
  ...DEFAULT_OPTIONS,
  fallbackFont: { family: "Inter", style: "Regular" },
};
function fixture(properties: Sketch = {}): SketchFile {
  return {
    name: "symbol-background.sketch",
    documentId: "DOC",
    version: 173,
    digest: "background",
    document: { do_objectID: "DOC", colorSpace: 1 },
    meta: {},
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
            _class: "symbolMaster",
            do_objectID: "M",
            symbolID: "SYMBOL",
            name: "Symbol",
            frame: { x: 0, y: 0, width: 100, height: 100 },
            style: { fills: [fill] },
            ...properties,
            layers: [
              {
                _class: "rectangle",
                do_objectID: "R",
                name: "Real white artwork",
                frame: { x: 10, y: 10, width: 20, height: 20 },
                style: { fills: [fill] },
              },
            ],
          },
          {
            _class: "symbolInstance",
            do_objectID: "I",
            symbolID: "SYMBOL",
            name: "Instance",
            frame: { x: 200, y: 0, width: 100, height: 100 },
            style: {},
            overrideValues: [],
          },
        ],
      },
    ],
  };
}
function node(host: ReturnType<typeof createHost>, id: string) {
  return host.nodes.get(readIndex(host.api, "DOC").nodes[id].nodeId);
}

describe("Symbol background content", () => {
  it.each([
    {
      groupBehavior: 0,
      hasBackgroundColor: 0,
      includeBackgroundColorInInstance: false,
    },
    {
      groupBehavior: 0,
      hasBackgroundColor: 1,
      includeBackgroundColorInInstance: false,
    },
    { groupBehavior: 0, includeBackgroundColorInInstance: true },
    { groupBehavior: 1, includeBackgroundColorInInstance: false },
    { groupBehavior: 1, includeBackgroundColorInInstance: 0 },
    { hasBackgroundColor: false, includeBackgroundColorInInstance: true },
    {
      hasBackgroundColor: true,
      includeBackgroundColorInInstance: false,
      backgroundColor: color,
    },
  ])(
    "excludes dormant background %j while retaining child artwork",
    async (properties) => {
      const host = createHost();
      const result = await startImport(host.api, fixture(properties), options)
        .result;
      expect(result.state).toBe("complete");
      expect(node(host, "M").fills).toEqual([]);
      expect(node(host, "I").fills).toEqual([]);
      expect(node(host, "R").fills[0].color).toEqual({ r: 1, g: 1, b: 1 });
      expect(
        result.validations.find((v) => v.kind === "symbol-background")?.passed,
      ).toBe(true);
    },
  );

  it("keeps modern Frame Symbol paints without adding a second legacy background", async () => {
    const host = createHost();
    const file = fixture({
      groupBehavior: 1,
      includeBackgroundColorInInstance: true,
      hasBackgroundColor: true,
      backgroundColor: { ...color, red: 0 },
    });
    await startImport(host.api, file, options).result;
    expect(node(host, "M").fills).toHaveLength(1);
    expect(node(host, "M").fills[0].color).toEqual({ r: 1, g: 1, b: 1 });
    expect(node(host, "I").fills).toEqual(node(host, "M").fills);
  });

  it("uses only the enabled legacy background and keeps ordinary frame fills", async () => {
    const host = createHost();
    const file = fixture({
      hasBackgroundColor: true,
      includeBackgroundColorInInstance: true,
      backgroundColor: { ...color, red: 0 },
    });
    file.pages[0].layers.push({
      _class: "group",
      groupBehavior: 1,
      do_objectID: "F",
      name: "Filled frame",
      frame: { x: 400, y: 0, width: 100, height: 100 },
      style: { fills: [fill] },
    });
    await startImport(host.api, file, options).result;
    expect(node(host, "M").fills).toHaveLength(1);
    expect(node(host, "M").fills[0].color).toEqual({ r: 0, g: 1, b: 1 });
    expect(node(host, "F").fills[0].color).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("repairs revision-11 imports in place and reuses the corrected result", async () => {
    const host = createHost();
    const file = fixture({
      groupBehavior: 0,
      includeBackgroundColorInInstance: false,
    });
    await startImport(host.api, file, options).result;
    const index = readIndex(host.api, "DOC");
    const ids = Object.values(index.nodes).map((n) => n.nodeId);
    for (const id of ["M", "I"])
      node(host, id).fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    for (const source of walkLayers(file.pages).filter(
      (s) => s._class !== "page",
    ))
      index.nodes[sourceId(source)] = await mapping(
        node(host, sourceId(source)),
        source,
        "revision-11",
      );
    writeData(host.api.root, "index:DOC", index);
    const repaired = await startImport(host.api, file, options).result;
    expect(repaired.state).toBe("complete");
    expect(repaired.created).toBe(0);
    expect(repaired.preserved).toBe(0);
    expect(node(host, "M").fills).toEqual([]);
    expect(node(host, "I").fills).toEqual([]);
    expect(
      Object.values(readIndex(host.api, "DOC").nodes).map((n) => n.nodeId),
    ).toEqual(ids);
    const repeated = await startImport(host.api, file, options).result;
    expect(repeated.created).toBe(0);
    expect(repeated.updated).toBe(0);
  });

  it("reports a locally preserved unexpected background instead of silently passing", async () => {
    const host = createHost();
    const file = fixture({
      groupBehavior: 0,
      includeBackgroundColorInInstance: false,
    });
    await startImport(host.api, file, options).result;
    node(host, "M").fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
    const result = await startImport(host.api, file, options).result;
    expect(result.preserved).toBeGreaterThan(0);
    expect(
      result.validations.find((v) => v.kind === "symbol-background")?.passed,
    ).toBe(false);
    expect(node(host, "M").fills[0].color.r).toBe(1);
  });

  it("does not validate dormant swatches as visible paint bindings", async () => {
    const host = createHost();
    const file = fixture({
      groupBehavior: 0,
      includeBackgroundColorInInstance: false,
      style: { fills: [{ ...fill, color: { ...color, swatchID: "DORMANT" } }] },
    });
    const result = await startImport(host.api, file, options).result;
    expect(
      result.validations.filter(
        (v) => v.sourceId === "M" && v.kind === "variable-binding",
      ),
    ).toEqual([]);
    expect(
      result.findings.filter(
        (f) => f.sourceId === "M" && f.code === "VARIABLE_REFERENCE",
      ),
    ).toEqual([]);
  });
});
