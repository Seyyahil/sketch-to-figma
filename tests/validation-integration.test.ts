import { describe, expect, it } from "vitest";
import {
  auditGeometry,
  multiplyTransforms,
  networkBounds,
} from "../src/figma/geometry-validation";
import { DEFAULT_OPTIONS, type SketchFile } from "../src/core/types";
import { startImport } from "../src/figma/importer";
import { readIndex } from "../src/figma/storage";
import { ImportContext } from "../src/figma/context";
import { validateImport } from "../src/figma/validation";
import { createHost } from "./mock-figma";
const file = (): SketchFile => ({
  name: "geometry-unit.sketch",
  documentId: "GEOMETRY-UNIT",
  version: 196,
  digest: "geometry-unit",
  document: {},
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
          _class: "shapePath",
          do_objectID: "LINE",
          name: "Line",
          rotation: 0,
          isFlippedHorizontal: false,
          isFlippedVertical: false,
          frame: { x: 15, y: 61, width: 345, height: 2 },
          points: [{ point: "{0, 0.5}" }, { point: "{1, 0.5}" }],
          style: {
            borders: [
              {
                isEnabled: true,
                thickness: 1,
                position: 0,
                fillType: 0,
                color: { red: 0, green: 0, blue: 0, alpha: 1 },
              },
            ],
          },
        },
      ],
    },
  ],
});
function host(moveY = 0, shorten = 0) {
  const h = createHost(),
    create = h.api.createVector;
  h.api.createVector = () => {
    const node = create();
    // Explicitly simulate origin rebasing here; the shared host double does not render vectors.
    node.setVectorNetworkAsync = async (input) => {
      const network = structuredClone(input),
        bounds = networkBounds(network);
      node.relativeTransform = multiplyTransforms(node.relativeTransform, [
        [1, 0, bounds.x],
        [0, 1, bounds.y],
      ]);
      node.relativeTransform = [
        node.relativeTransform[0],
        [
          node.relativeTransform[1][0],
          node.relativeTransform[1][1],
          node.relativeTransform[1][2] + moveY,
        ],
      ];
      const native = {
        ...network,
        vertices: network.vertices.map((v) => ({
          ...v,
          x: v.x - bounds.x,
          y: v.y - bounds.y,
        })),
      };
      native.vertices[1].x -= shorten;
      Object.assign(node, {
        vectorNetwork: native,
        width: bounds.width - shorten,
        height: bounds.height,
      });
    };
    return node;
  };
  return h;
}
describe("geometry report integration", () => {
  it("records a rebased line as equivalent without downgrading frame properties or reporting a lost border", async () => {
    const h = host(),
      source = file(),
      report = await startImport(h.api, source, DEFAULT_OPTIONS).result;
    expect(report.state).toBe("complete");
    expect(
      report.validations
        .filter((v) =>
          ["geometry", "transform", "border-geometry"].includes(v.kind),
        )
        .map((v) => v.passed),
    ).toEqual([true, true, true]);
    expect(
      report.findings.some((f) =>
        [
          "GEOMETRY_DIFFERENCE",
          "TRANSFORM_DIFFERENCE",
          "GEOMETRY_UNVERIFIED",
        ].includes(f.code),
      ),
    ).toBe(false);
    const properties = report.layers.find(
      (l) => l.sourceId === "LINE",
    )!.properties;
    for (const path of [
      "/frame/x",
      "/frame/y",
      "/frame/width",
      "/frame/height",
      "/rotation",
      "/isFlippedHorizontal",
      "/isFlippedVertical",
    ])
      expect(properties.find((p) => p.path === path)?.status, path).toBe(
        "Native",
      );
  });
  it("reports actual movement and downgrades only the affected position property", async () => {
    const report = await startImport(host(1).api, file()).result;
    const properties = report.layers.find(
      (l) => l.sourceId === "LINE",
    )!.properties;
    expect(properties.find((p) => p.path === "/frame/y")?.status).toBe(
      "Partial",
    );
    for (const path of [
      "/frame/x",
      "/rotation",
      "/isFlippedHorizontal",
      "/isFlippedVertical",
    ])
      expect(properties.find((p) => p.path === path)?.status, path).toBe(
        "Native",
      );
    expect(
      report.validations.find((v) => v.kind === "transform")?.actual,
    ).toMatchObject({ differences: ["y"] });
  });
  it("keeps genuine width differences and the 1px stroke check independent", async () => {
    const report = await startImport(host(0, 1).api, file()).result;
    expect(report.validations.find((v) => v.kind === "geometry")?.passed).toBe(
      false,
    );
    expect(
      report.validations.find((v) => v.kind === "border-geometry")?.passed,
    ).toBe(true);
    expect(report.validations.find((v) => v.kind === "transform")?.passed).toBe(
      true,
    );
    const properties = report.layers.find(
      (l) => l.sourceId === "LINE",
    )!.properties;
    expect(properties.find((p) => p.path === "/frame/width")?.status).toBe(
      "Partial",
    );
    expect(properties.find((p) => p.path === "/frame/height")?.status).toBe(
      "Native",
    );
  });
  it("does not accept rejected vector writes or falsely pass their empty readback", async () => {
    const h = createHost(),
      create = h.api.createVector;
    h.api.createVector = () => {
      const n = create();
      n.setVectorNetworkAsync = async () => {
        throw new Error("Rejected path");
      };
      return n;
    };
    const report = await startImport(h.api, file()).result;
    expect(report.findings.some((f) => f.code === "API_REJECTED")).toBe(true);
    expect(report.findings.some((f) => f.code === "GEOMETRY_UNVERIFIED")).toBe(
      true,
    );
    expect(report.validations.find((v) => v.kind === "geometry")?.passed).toBe(
      null,
    );
    expect(report.validations.find((v) => v.kind === "transform")?.passed).toBe(
      null,
    );
  });
  it("rechecks unchanged imported nodes, without requiring a converter revision bump", async () => {
    const h = host(),
      source = file();
    await startImport(h.api, source).result;
    const node = h.nodes.get(
      readIndex(h.api, source.documentId).nodes.LINE.nodeId,
    );
    node.relativeTransform[0][2] += 1;
    const report = await startImport(h.api, source).result;
    expect(report.validations.find((v) => v.kind === "transform")?.passed).toBe(
      false,
    );
    expect(
      auditGeometry(source.pages[0].layers[0], node).changedPlacement,
    ).toEqual(["x"]);
  });
});

it("retains Hug parent failures and identifies related child failures without claiming an independent cause", async () => {
  const source = file();
  source.pages[0].layers = [
    {
      _class: "group",
      do_objectID: "STACK",
      name: "Stack",
      frame: { x: 0, y: 0, width: 335, height: 200 },
      horizontalSizing: 0,
      verticalSizing: 1,
      groupLayout: {
        _class: "MSImmutableFlexGroupLayout",
        flexDirection: 1,
        allGuttersGap: 0,
      },
      layers: [
        {
          _class: "rectangle",
          do_objectID: "CHILD",
          name: "Child",
          frame: { x: 0, y: 0, width: 335, height: 200 },
        },
      ],
    },
  ];
  const h = createHost(),
    imported = await startImport(h.api, source).result;
  const index = readIndex(h.api, source.documentId),
    report = { ...imported, findings: [], validations: [] };
  const ctx = new ImportContext(
    h.api,
    source,
    DEFAULT_OPTIONS,
    report,
    index,
    { track() {}, trackResource() {}, async before() {} },
    () => {},
  );
  for (const [id, mapping] of Object.entries(index.nodes))
    ctx.nodes.set(id, h.nodes.get(mapping.nodeId));
  const stack = ctx.nodes.get("STACK")!,
    child = ctx.nodes.get("CHILD")!;
  (stack as FrameNode).layoutSizingVertical = "HUG";
  Object.assign(stack, { height: 180 });
  Object.assign(child, { height: 180 });
  await validateImport(ctx, new Set(["STACK", "CHILD"]));
  const failures = ctx.report.validations.filter(
    (v) => v.kind === "geometry" && v.passed === false,
  );
  expect(failures).toHaveLength(2);
  const parent = failures.find((v) => v.sourceId === "STACK")!;
  expect(parent.message).toContain("Auto Layout hugs height");
  expect(parent.message).toContain("related child size differences: Child");
  expect(parent.message).toContain("no independent cause is inferred");
});

it("does not treat two missing component IDs as a preserved Symbol link", async () => {
  const source = file();
  source.pages[0].layers = [
    {
      _class: "symbolInstance",
      do_objectID: "MISSING",
      name: "Missing Symbol",
      symbolID: "ABSENT",
      frame: { x: 0, y: 0, width: 20, height: 20 },
    },
  ];
  const report = await startImport(createHost().api, source).result;
  expect(
    report.validations.find((v) => v.kind === "component-link"),
  ).toMatchObject({ passed: false, expected: "ABSENT" });
});
it("does not count a removed mapped node as a preserved source layer", async () => {
  const source = file(),
    h = createHost(),
    imported = await startImport(h.api, source).result;
  const index = readIndex(h.api, source.documentId),
    report = { ...imported, findings: [], validations: [] };
  const ctx = new ImportContext(
    h.api,
    source,
    DEFAULT_OPTIONS,
    report,
    index,
    { track() {}, trackResource() {}, async before() {} },
    () => {},
  );
  const node = h.nodes.get(index.nodes.LINE.nodeId);
  ctx.nodes.set("LINE", node);
  Object.assign(node, { removed: true });
  await validateImport(ctx, new Set(["LINE"]));
  expect(
    ctx.report.validations.find((v) => v.kind === "layer-exists")?.passed,
  ).toBe(false);
  expect(
    ctx.report.validations.find((v) => v.kind === "layer-count"),
  ).toMatchObject({ passed: false, expected: 1, actual: 0 });
});
