import { describe, it, expect, vi } from "vitest";
import { readTestSketch, testSketchPath } from "./private-sketch";
import { zipSync, strToU8 } from "fflate";
import {
  parseSketch,
  inspectZip,
  extractZip,
  crc32,
} from "../src/sketch/archive";
import { preflight } from "../src/sketch/preflight";
import { Ledger, leaves } from "../src/core/audit";
import { dependencyOrder, selection } from "../src/core/dependencies";
import {
  constraints,
  gradientTransform,
  pathData,
  transform,
  vectorNetwork,
} from "../src/core/math";
import { validateTokens } from "../src/figma/resources";
import { comparePixels } from "../src/core/pixels";
it.skipIf(!testSketchPath)(
  "parses and preflights the supplied Test.sketch archive",
  async () => {
    const parsed = await parseSketch(
        new Uint8Array(readTestSketch()),
        "Test.sketch",
      ),
      preview = preflight(parsed);
    expect(parsed.documentId).toBeTruthy();
    expect(parsed.pages).toHaveLength(3);
    expect(preview.pages.every((p) => p.id)).toBe(true);
    expect(parsed.version).toBeGreaterThanOrEqual(123);
    expect(preview.symbols).toHaveLength(49);
  },
  30000,
);
describe("archive integrity", () => {
  it("transfers parsed worker asset buffers without copying their binary payload", async () => {
    let received: any;
    let sent: any;
    const scope = {
      onmessage: null as ((event: MessageEvent) => Promise<void>) | null,
      postMessage(message: unknown, options?: StructuredSerializeOptions) {
        sent = message;
        received = structuredClone(message, options);
      },
    };
    vi.stubGlobal("self", scope);
    try {
      await import("../src/sketch/worker");
      const bytes = zipSync({
        "document.json": strToU8('{"do_objectID":"D","pages":[]}'),
        "meta.json": strToU8('{"version":196}'),
        "images/asset.bin": new Uint8Array([1, 2, 3]),
      });
      await scope.onmessage!({
        data: { id: "REQUEST", name: "transport.sketch", bytes: bytes.buffer },
      } as MessageEvent);
      expect(received.error).toBeUndefined();
      expect(received.id).toBe("REQUEST");
      expect(received.file.assets[0].bytes).toEqual(new Uint8Array([1, 2, 3]));
      expect(sent.file.assets[0].bytes.byteLength).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("rejects non-ZIP and truncated files", async () => {
    await expect(parseSketch(new Uint8Array([1, 2, 3]), "bad")).rejects.toThrow(
      "ZIP",
    );
    const good = zipSync({ "document.json": strToU8("{}") });
    await expect(parseSketch(good.subarray(0, -8), "bad")).rejects.toThrow(
      "truncated",
    );
  });
  it("rejects path traversal", () => {
    expect(() => inspectZip(zipSync({ "../secret": strToU8("x") }))).toThrow(
      "Unsafe",
    );
  });
  it("checks decompressed CRC rather than trusting metadata", async () => {
    const z = zipSync({ "document.json": strToU8("{}") }, { level: 0 });
    z[43] ^= 1;
    await expect(parseSketch(z, "bad")).rejects.toThrow(/checksum|ZIP|JSON/);
  });
  it("implements the standard CRC check value", () => {
    expect(crc32(strToU8("123456789"))).toBe(0xcbf43926);
  });
  it("rejects duplicate layer IDs and nonfinite bounds", async () => {
    const p = {
      _class: "page",
      do_objectID: "P",
      layers: [
        {
          _class: "rectangle",
          do_objectID: "R",
          frame: { x: 0, y: 0, width: 10, height: 10 },
        },
        {
          _class: "rectangle",
          do_objectID: "R",
          frame: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
    };
    const z = zipSync({
      "document.json": strToU8(
        JSON.stringify({ do_objectID: "D", pages: [p] }),
      ),
      "meta.json": strToU8('{"version":144}'),
    });
    await expect(parseSketch(z, "bad")).rejects.toThrow("Duplicate");
  });
  it("extracts a ZIP larger than the former 256 MiB archive cap", async () => {
    const small = zipSync({ "document.json": strToU8("{}") }, { level: 0 });
    const directory = inspectZip(small).get("document.json")!.directoryOffset;
    // Legal unreferenced padding exercises a real large input without a huge asset.
    const large = new Uint8Array(256 * 1024 * 1024 + small.length + 1);
    const nextDirectory = large.length - (small.length - directory);
    large.set(small.subarray(0, directory));
    large.set(small.subarray(directory), nextDirectory);
    new DataView(large.buffer).setUint32(
      large.length - 22 + 16,
      nextDirectory,
      true,
    );
    const extracted = await extractZip(large);
    expect(extracted.get("document.json")).toEqual(strToU8("{}"));
  });
  it("indexes more than the former 20,000 ZIP entry cap", () => {
    const files = Object.fromEntries(
      Array.from({ length: 20001 }, (_, i) => [`entry-${i}`, new Uint8Array()]),
    );
    expect(inspectZip(zipSync(files, { level: 0 })).size).toBe(20001);
  });
  it("does not cap declared asset sizes or their expanded total during inspection", () => {
    const zipped = zipSync({
      "images/a": new Uint8Array(),
      "images/b": new Uint8Array(),
    });
    const entries = inspectZip(zipped);
    const view = new DataView(
      zipped.buffer,
      zipped.byteOffset,
      zipped.byteLength,
    );
    let directory = entries.get("images/a")!.directoryOffset;
    // Inspection reads directory metadata only; do not allocate/decompress these entries.
    for (let i = 0; i < 2; i++) {
      view.setUint32(directory + 24, 300 * 1024 * 1024, true);
      directory +=
        46 +
        view.getUint16(directory + 28, true) +
        view.getUint16(directory + 30, true) +
        view.getUint16(directory + 32, true);
    }
    const inspected = [...inspectZip(zipped).values()];
    expect(inspected.map((entry) => entry.size)).toEqual([
      300 * 1024 * 1024,
      300 * 1024 * 1024,
    ]);
    expect(inspected.reduce((total, entry) => total + entry.size, 0)).toBe(
      600 * 1024 * 1024,
    );
  });
  it("still rejects payloads longer than the ZIP-declared entry length", async () => {
    const zipped = zipSync(
      { "data.bin": new Uint8Array([1, 2]) },
      { level: 0 },
    );
    const directory = inspectZip(zipped).get("data.bin")!.directoryOffset;
    const view = new DataView(
      zipped.buffer,
      zipped.byteOffset,
      zipped.byteLength,
    );
    view.setUint32(22, 1, true);
    view.setUint32(directory + 24, 1, true);
    await expect(extractZip(zipped)).rejects.toThrow("ZIP length mismatch");
  });
  it("parses documents beyond the former 150,000 layer cap", async () => {
    const page = {
      _class: "page",
      do_objectID: "P",
      layers: Array.from({ length: 150001 }, (_, i) => ({
        _class: "rectangle",
        do_objectID: `L${i}`,
      })),
    };
    const zipped = zipSync(
      {
        "document.json": strToU8(
          JSON.stringify({ do_objectID: "D", pages: [page] }),
        ),
        "meta.json": strToU8('{"version":196}'),
      },
      { level: 0 },
    );
    const parsed = await parseSketch(zipped, "many-layers.sketch");
    expect(parsed.pages[0].layers).toHaveLength(150001);
    expect(parsed.pages[0].layers[150000].do_objectID).toBe("L150000");
  }, 30000);
  it("parses documents deeper than the former 256 level cap", async () => {
    let nested: Record<string, unknown> = {
      _class: "rectangle",
      do_objectID: "LEAF",
    };
    for (let i = 0; i < 300; i++)
      nested = { _class: "group", do_objectID: `G${i}`, layers: [nested] };
    const page = { _class: "page", do_objectID: "P", layers: [nested] };
    const zipped = zipSync({
      "document.json": strToU8(
        JSON.stringify({ do_objectID: "D", pages: [page] }),
      ),
      "meta.json": strToU8('{"version":196}'),
    });
    const parsed = await parseSketch(zipped, "deep-layers.sketch");
    let current = parsed.pages[0];
    for (let i = 0; i < 301; i++) current = current.layers[0];
    expect(current.do_objectID).toBe("LEAF");
  });
});
describe("property coverage", () => {
  it("claims exact leaves without swallowing unknown siblings", () => {
    const raw = {
      "a/b": { known: 1, newFeature: 2 },
      empty: [],
      zero: 0,
      unset: null,
    };
    const l = new Ledger(raw, {
      sourceId: "x",
      name: "x",
      sourceType: "rectangle",
      selected: true,
      properties: [],
    });
    l.mark("/a~1b/known");
    l.mark("/a~1b");
    const out = l.finalize();
    expect(out.properties).toHaveLength(leaves(raw).length);
    expect(
      out.properties.find((p) => p.path === "/a~1b/newFeature")?.status,
    ).toBe("Unsupported");
    expect(out.properties.find((p) => p.path === "/empty")?.status).toBe(
      "Unsupported",
    );
  });
});
describe("geometry and graphs", () => {
  it("preserves a clockwise center rotation as a matrix", () => {
    expect(
      transform({
        frame: { x: 10, y: 20, width: 100, height: 50 },
        rotation: 90,
      })[0][2],
    ).toBeCloseTo(35);
  });
  it("keeps open Bézier paths and native control points", () => {
    const s = {
      frame: { width: 100, height: 50 },
      isClosed: false,
      points: [
        { point: "{0, 0}", curveFrom: "{0.3, 0}", hasCurveFrom: true },
        { point: "{1, 1}", curveTo: "{0.7, 1}", hasCurveTo: true },
      ],
    };
    expect(pathData(s)).toBe("M 0 0 C 30 0 70 50 100 50");
    expect(vectorNetwork(s).segments[0].tangentEnd?.x).toBe(-30);
    expect(vectorNetwork(s).regions).toEqual([]);
  });
  it("maps a horizontal linear gradient to identity", () => {
    gradientTransform({ from: "{0, 0.5}", to: "{1, 0.5}", gradientType: 0 })
      .flat()
      .forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, 0, 1, 0][i]));
  });
  it("maps fixed-edge bitmasks", () => {
    expect(constraints(63)).toEqual({ horizontal: "SCALE", vertical: "SCALE" });
    expect(constraints(0)).toEqual({
      horizontal: "STRETCH",
      vertical: "STRETCH",
    });
  });
  it("selects descendants and structural ancestors", () => {
    const p = [
      {
        do_objectID: "P",
        layers: [
          {
            do_objectID: "G",
            layers: [{ do_objectID: "A" }, { do_objectID: "B" }],
          },
        ],
      },
    ];
    expect([...selection(p, ["A"])].sort()).toEqual(["A", "G", "P"]);
  });
  it("orders Symbol dependencies and reports cycles", () => {
    const a = {
        symbolID: "A",
        layers: [{ _class: "symbolInstance", symbolID: "B" }],
      },
      b = { symbolID: "B", layers: [] };
    expect(
      dependencyOrder(
        new Map([
          ["A", a],
          ["B", b],
        ]),
      ).ordered.map((s) => s.symbolID),
    ).toEqual(["B", "A"]);
    b.layers.push({ _class: "symbolInstance", symbolID: "A" } as never);
    expect(
      dependencyOrder(
        new Map([
          ["A", a],
          ["B", b],
        ]),
      ).cycles,
    ).toHaveLength(1);
  });
});
describe("pixel QA", () => {
  it("compares alpha and channels without rescaling or hiding differences", () => {
    const a = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]),
      b = new Uint8ClampedArray([0, 0, 0, 255, 255, 0, 0, 255]);
    const d = comparePixels(a, b, 2, 1);
    expect(d.changedPixels).toBe(1);
    expect(d.changedRatio).toBe(0.5);
    expect(d.meanAbsoluteError).toBe(255 / 8);
    expect(() => comparePixels(a, b, 1, 1)).toThrow();
  });
});

describe("token validation", () => {
  it("rejects nonfinite numeric tokens and incorrect primitive types", () => {
    const input = {
      collection: "UI",
      modes: ["Default"],
      tokens: [{ name: "gap", type: "FLOAT", values: { Default: Infinity } }],
    };
    expect(() => validateTokens(input as any)).toThrow("Invalid FLOAT");
    input.tokens[0].values.Default = "12" as any;
    expect(() => validateTokens(input as any)).toThrow("Invalid FLOAT");
  });
  it("accepts typed aliases and rejects out of gamut color values", () => {
    const input = {
      collection: "UI",
      modes: ["Default"],
      tokens: [
        {
          name: "red",
          type: "COLOR",
          values: { Default: { r: 1.5, g: 0, b: 0 } },
        },
      ],
    };
    expect(() => validateTokens(input as any)).toThrow("Invalid COLOR");
    input.tokens[0].values.Default = "{base}" as any;
    expect(validateTokens(input as any)).toBe(input);
  });
});
