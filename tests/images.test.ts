import { expect, it } from "vitest";
import { PNG } from "pngjs";
import { imageDimensions, nativePayload } from "../src/ui/asset-preparation";
import { bindingFixture } from "./binding-fixture";
import { createHost } from "./mock-figma";
import { startImport } from "../src/figma/importer";
import { DEFAULT_OPTIONS, type Sketch } from "../src/core/types";
import { readData, readIndex } from "../src/figma/storage";
import { alphaFixture } from "./alpha-fixture";
import { preflight } from "../src/sketch/preflight";

it("reads PNG and JPEG dimensions without decoding full images", () => {
  const png = PNG.sync.write(new PNG({ width: 7, height: 5 }));
  expect(imageDimensions(png)).toEqual({ width: 7, height: 5 });
  const jpeg = new Uint8Array([
    255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 11, 8, 0, 7, 0, 9, 3, 1, 17, 0,
    255, 217,
  ]);
  expect(imageDimensions(jpeg)).toEqual({ width: 9, height: 7 });
  expect(
    imageDimensions(new Uint8Array([255, 216, 255, 192, 255, 255])),
  ).toBeUndefined();
});

it("preserves full-resolution tile coverage and source asset identity without resending unusable bytes", async () => {
  const file = bindingFixture();
  file.assets = [
    {
      path: "images/large.png",
      bytes: new Uint8Array([1, 2, 3]),
      tiles: {
        width: 5000,
        height: 2000,
        items: [
          {
            path: "images/large.png.tile-0-0.png",
            x: 0,
            y: 0,
            width: 4096,
            height: 2000,
          },
          {
            path: "images/large.png.tile-4096-0.png",
            x: 4096,
            y: 0,
            width: 904,
            height: 2000,
          },
        ],
      },
    },
    { path: "images/large.png.tile-0-0.png", bytes: new Uint8Array([4]) },
    { path: "images/large.png.tile-4096-0.png", bytes: new Uint8Array([5]) },
  ];
  file.pages[0].layers = [
    {
      _class: "bitmap",
      do_objectID: "BITMAP",
      name: "Large original",
      frame: { x: 0, y: 0, width: 500, height: 200 },
      image: { _ref: "images/large.png", _ref_class: "MSImageData" },
      style: {
        fills: [
          { fillType: 0, color: { red: 0, green: 0, blue: 0, alpha: 0.2 } },
        ],
      },
    },
  ];
  const payload = nativePayload(file);
  expect(payload.assets[0].bytes.length).toBe(0);
  expect(payload.assets[0].originalByteLength).toBe(3);
  expect(file.assets[0].bytes.length).toBe(3);
  expect(preflight(payload).images).toBe(1);
  const h = createHost(),
    options = {
      ...DEFAULT_OPTIONS,
      conflict: "replace-imported" as const,
      fallbackFont: { family: "Inter", style: "Regular" },
    };
  const report = await startImport(h.api, payload, options).result;
  expect(report.findings.filter((f) => f.severity === "error")).toEqual([]);
  const target = () =>
    h.nodes.get(readIndex(h.api, file.documentId).nodes.BITMAP.nodeId);
  const node = target(),
    tiles = node.children.filter((c: any) =>
      c.getPluginData("sketch2figma:tile"),
    );
  expect(node.type).toBe("FRAME");
  expect(node.clipsContent).toBe(false);
  const expected = [
    [0, 0, 409.6, 200],
    [409.6, 0, 90.4, 200],
  ];
  tiles.forEach((n: any, i: number) =>
    [n.x, n.y, n.width, n.height].forEach((v: number, j: number) =>
      expect(v).toBeCloseTo(expected[i][j], 8),
    ),
  );
  expect(node.children.at(-1).getPluginData("sketch2figma:wrapper")).toBe(
    "bitmap-paints",
  );
  expect(readData<Sketch>(node, "imageTiles", {}).width).toBe(5000);
  const ids = tiles.map((n: any) => n.id);
  // A square viewport crops the wide source with editable per-tile image paints.
  file.pages[0].layers[0].frame.width = 200;
  await startImport(h.api, nativePayload(file), options).result;
  expect(target().clipsContent).toBe(false);
  const cropped = target().children.filter((c: any) =>
    c.getPluginData("sketch2figma:tile"),
  );
  expect(cropped[0].x).toBe(0);
  expect(cropped[0].width).toBe(200);
  expect(cropped[0].fills[0].imageTransform[0]).toEqual([
    200 / 409.6,
    0,
    150 / 409.6,
  ]);
  expect(cropped[1].visible).toBe(false);
  file.pages[0].layers[0].name = "Renamed bitmap";
  await startImport(h.api, nativePayload(file), options).result;
  expect(
    target()
      .children.filter((c: any) => c.getPluginData("sketch2figma:tile"))
      .map((n: any) => n.id),
  ).toEqual(ids);
  file.pages[0].layers[0].image._ref = "images/small.png";
  file.assets.push({ path: "images/small.png", bytes: new Uint8Array([9]) });
  await startImport(h.api, nativePayload(file), options).result;
  expect(target().children).toHaveLength(0);
  expect(target().fills[0].type).toBe("IMAGE");
});

it("reconstructs Sketch progressive opacity as an editable mask without covering the photo", async () => {
  const f = bindingFixture();
  f.pages[0].layers = [
    {
      _class: "bitmap",
      do_objectID: "FADE",
      name: "Fade",
      frame: { x: 10, y: 20, width: 100, height: 50 },
      image: { _ref: "images/photo.png" },
      style: {
        contextSettings: {
          opacity: 1,
          blendMode: 0,
          isProgressive: true,
          gradient: {
            gradientType: 0,
            from: "{0, 0.5}",
            to: "{1, 0.5}",
            stops: [
              { position: 0, color: { red: 1, green: 1, blue: 1, alpha: 1 } },
              { position: 1, color: { red: 1, green: 1, blue: 1, alpha: 0 } },
            ],
          },
        },
      },
    },
  ];
  f.assets = [{ path: "images/photo.png", bytes: new Uint8Array([1]) }];
  const h = createHost(),
    options = {
      ...DEFAULT_OPTIONS,
      conflict: "replace-imported" as const,
      fallbackFont: { family: "Inter", style: "Regular" },
    };
  const r = await startImport(h.api, f, options).result,
    n = h.nodes.get(readIndex(h.api, f.documentId).nodes.FADE.nodeId);
  expect(
    r.validations.filter((v) => v.kind === "transform" && v.passed === false),
  ).toEqual([]);
  expect(n.fills[0].type).toBe("IMAGE");
  expect(n.parent.children[0].maskType).toBe("ALPHA");
  expect(n.parent.children[0].fills[0].gradientStops[1].color.a).toBe(0);
  expect(n.parent.x).toBe(10);
  const count = h.nodes.size;
  await startImport(h.api, f, options).result;
  expect(h.nodes.size).toBe(count);
  f.pages[0].layers[0].frame.x = 30;
  await startImport(h.api, f, options).result;
  expect(h.nodes.size).toBe(count);
  expect(n.parent.x).toBe(30);
  f.pages[0].layers[0].style.contextSettings.isProgressive = false;
  await startImport(h.api, f, options).result;
  expect(n.parent.type).toBe("PAGE");
  expect(n.x).toBe(30);
});

it("keeps independent paint opacity and alpha-variable aliases without inventing color resources", async () => {
  const h = createHost(),
    file = alphaFixture();
  const report = await startImport(h.api, file, DEFAULT_OPTIONS).result;
  const index = readIndex(h.api, file.documentId);
  const node = h.nodes.get(index.nodes.ALPHA_OPACITY.nodeId);
  expect(node.fills[0].type).toBe("GRADIENT_LINEAR");
  expect(node.fills[0].opacity).toBe(0.5);
  const id = index.resources["color:ALPHA_COLOR"];
  expect(
    node.fills[0].gradientStops.map((s: any) => s.boundVariables.color.id),
  ).toEqual([id, id]);
  expect(h.variables.size).toBe(1);
  expect(
    report.validations.filter(
      (v) => v.kind === "variable-binding" && v.passed === false,
    ),
  ).toEqual([]);
});
