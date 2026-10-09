import { describe, it, expect } from "vitest";
import { readTestSketch, testSketchPath } from "./private-sketch";
import { zipSync, strToU8 } from "fflate";
import { parseSketch, inspectZip, crc32 } from "../src/sketch/archive";
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
