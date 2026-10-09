import { auditGeometry } from "../src/figma/geometry-validation";
import { transform } from "../src/core/math";
import {
  textRanges,
  textRangeValues,
  textStyleValues,
  textStyleDifferences,
} from "../src/figma/text-style-values";
import { instanceTextSources } from "../src/figma/instance-text-styles";
import { readTestSketch, testSketchPath } from "./private-sketch";
import { unzipSync, strFromU8 } from "fflate";
import { beforeAll, it, expect } from "vitest";
import { createHost } from "./mock-figma";
import { startImport } from "../src/figma/importer";
import {
  DEFAULT_OPTIONS,
  walkLayers,
  type SketchFile,
  type ImportOptions,
} from "../src/core/types";
import { readIndex } from "../src/figma/storage";
import { parseSketch } from "../src/sketch/archive";
import { sameFont, samePaints } from "../src/figma/typography";
// Load the private archive only for explicitly enabled acceptance tests.
let document: any, meta: any, file: SketchFile;
let all: ReturnType<typeof walkLayers>;
beforeAll(() => {
  if (!testSketchPath) return;
  const zip = unzipSync(new Uint8Array(readTestSketch()), {
    filter: (f) => f.name.endsWith(".json"),
  });
  const json = (path: string) => JSON.parse(strFromU8(zip[path]));
  document = json("document.json");
  meta = json("meta.json");
  file = {
    name: "Test.sketch",
    documentId: "TEST-ACCEPTANCE",
    version: meta.version,
    document,
    meta,
    user: {},
    assets: [],
    digest: "test-original-metadata",
    warnings: [],
    pages: document.pages.map((p: any) => json(p._ref + ".json")),
  };
  all = walkLayers(file.pages);
});
const acceptanceTest = it.skipIf(!testSketchPath);
async function imported(extra: Partial<ImportOptions> = {}) {
  const h = createHost();
  h.api.listAvailableFontsAsync = async () =>
    [
      "Arial-Regular",
      "Arial-Bold",
      "LucidaGrande-Bold",
      "Poppins-Bold",
      "Poppins-SemiBold",
      "Poppins-Medium",
      "Poppins-ExtraBold",
      "Poppins-MediumItalic",
    ].map((n) => {
      const [family, style] = n.split("-");
      return { fontName: { family, style } };
    });
  const r = await startImport(h.api, structuredClone(file), {
    ...DEFAULT_OPTIONS,
    conflict: "replace-imported",
    ...extra,
  }).result;
  const index = readIndex(h.api, file.documentId),
    target = (id: string) => h.nodes.get(index.nodes[id]?.nodeId);
  return { h, r, index, target };
}
acceptanceTest(
  "reads the repository acceptance document and its resource inventory",
  () => {
    expect([182, 196]).toContain(meta.version);
    expect(all.length).toBe(1336);
    expect(document.sharedSwatches.objects).toHaveLength(29);
    expect(document.layerTextStyles.objects).toHaveLength(19);
    expect(document.layerStyles.objects).toHaveLength(3);
    expect(
      all.filter((s) => s.groupLayout?._class === "MSImmutableFlexGroupLayout"),
    ).toHaveLength(181);
  },
);
acceptanceTest(
  "imports actual Stacks, source padding, child flow, corner radii and fixed/fill sizing",
  async () => {
    const { r, target } = await imported();
    expect(
      r.findings.filter(
        (f) => f.code === "API_REJECTED" || f.code === "TEXT_FAILURE",
      ),
    ).toEqual([]);
    const stacks = all.filter(
      (s) => s.groupLayout?._class === "MSImmutableFlexGroupLayout",
    );
    for (const source of stacks) {
      const n = target(source.do_objectID);
      expect(n, source.name).toBeTruthy();
      expect(n.layoutMode, source.name).toBe(
        source.groupLayout.flexDirection === 0 ? "HORIZONTAL" : "VERTICAL",
      );
      for (const [key, field] of [
        ["leftPadding", "paddingLeft"],
        ["rightPadding", "paddingRight"],
        ["topPadding", "paddingTop"],
        ["bottomPadding", "paddingBottom"],
      ])
        expect(n[field], source.name + key).toBe(source[key]);
      expect(n.itemSpacing, source.name).toBe(source.groupLayout.allGuttersGap);
      expect(
        n.children
          .filter((c: any) => c.getPluginData("sketch2figma:sourceId"))
          .map((c: any) => c.getPluginData("sketch2figma:sourceId")),
        source.name,
      ).toEqual(source.layers.map((c: any) => c.do_objectID).reverse());
      for (const child of source.layers) {
        const t = target(child.do_objectID);
        for (const [key, field] of [
          ["horizontalSizing", "layoutSizingHorizontal"],
          ["verticalSizing", "layoutSizingVertical"],
        ])
          if (child[key] === 0 || child[key] === 2)
            expect(t[field], child.name + key).toBe(
              child[key] === 2 && !child.flexItem?.ignoreLayout
                ? "FILL"
                : "FIXED",
            );
      }
    }
    for (const source of all.filter(
      (s) => s.style?.corners?.radii?.length && s.style.corners.style === 0,
    )) {
      const n = target(source.do_objectID),
        radii = source.style.corners.radii;
      if (!n || !["FRAME", "COMPONENT", "RECTANGLE"].includes(n.type)) continue;
      for (const [i, field] of [
        "topLeftRadius",
        "topRightRadius",
        "bottomRightRadius",
        "bottomLeftRadius",
      ].entries())
        expect(n[field], source.name + field).toBe(radii[i % radii.length]);
    }
  },
  30000,
);
acceptanceTest(
  "retains the source resource inventory, symbols and all source-property audit leaves",
  async () => {
    const { h, r, index, target } = await imported();
    expect(
      [...h.variables.values()].filter((v) => v.resolvedType === "COLOR"),
    ).toHaveLength(29);
    const resourceKeys = Object.keys(
      readIndex(h.api, file.documentId).resources,
    );
    expect(resourceKeys.filter((key) => key.startsWith("text:"))).toHaveLength(
      19,
    );
    expect(
      [...h.styles.values()].filter((v) => v.type === "TEXT"),
    ).toHaveLength(19);
    for (const swatch of document.sharedSwatches.objects)
      expect(
        h.variables.get(index.resources[`color:${swatch.do_objectID}`]).name,
      ).toBe(swatch.name);
    for (const shared of [
      ...document.layerStyles.objects,
      ...document.layerTextStyles.objects,
    ])
      for (const kind of ["paint", "stroke", "effect", "text"]) {
        const id = index.resources[`${kind}:${shared.do_objectID}`];
        if (id) expect(h.styles.get(id).name).toBe(shared.name);
      }
    for (const source of all) {
      const node = target(source.do_objectID);
      if (node) expect(node.name, source.do_objectID).toBe(source.name);
    }
    for (const source of all.filter((s) => s._class === "symbolMaster"))
      expect(target(source.do_objectID)?.type).toBe("COMPONENT");
    for (const source of all.filter((s) => s._class === "symbolInstance"))
      expect(
        target(source.do_objectID)?.main.symbolID ??
          target(source.do_objectID)?.main.getPluginData(
            "sketch2figma:sourceId",
          ),
      ).toBe(
        all.find(
          (s) => s._class === "symbolMaster" && s.symbolID === source.symbolID,
        )?.do_objectID,
      );
    expect(r.layers.filter((l) => l.sourceType === "text").length).toBe(164);
    expect(
      r.layers.every((l) => l.properties.every((p) => p.reason.length > 0)),
    ).toBe(true);
    const resources = structuredClone(index.resources);
    const again = await startImport(h.api, structuredClone(file), {
      ...DEFAULT_OPTIONS,
      conflict: "replace-imported",
    }).result;
    expect(again.created).toBe(0);
    expect(readIndex(h.api, file.documentId).resources).toEqual(resources);
  },
  30000,
);
acceptanceTest(
  "keeps named variable-font styles with extra host axes, and tolerates float32 paint readback",
  () => {
    expect(
      sameFont(
        {
          family: "Inter",
          style: "Regular",
          variationSettings: { wght: 400, slnt: 0 },
        },
        { family: "Inter", style: "Regular" },
      ),
    ).toBe(true);
    expect(
      sameFont(
        { family: "Inter", style: "Regular", variationSettings: { wght: 400 } },
        { family: "Inter", style: "Regular", variationSettings: { wght: 600 } },
      ),
    ).toBe(false);
    expect(
      samePaints(
        [
          {
            type: "SOLID",
            color: {
              r: Math.fround(0.2),
              g: Math.fround(0.4),
              b: Math.fround(0.8),
            },
            opacity: 1,
            visible: true,
            blendMode: "NORMAL",
          },
        ],
        [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.8 } }],
      ),
    ).toBe(true);
  },
);

acceptanceTest(
  "extracts the original large data-descriptor archive and preserves its embedded fonts",
  async () => {
    const parsed = await parseSketch(
      new Uint8Array(readTestSketch()),
      "Test.sketch",
    );
    expect(parsed.pages.map((p) => p.do_objectID)).toEqual(
      file.pages.map((p) => p.do_objectID),
    );
    expect(
      parsed.assets.filter((a) => a.path.startsWith("fonts/")),
    ).toHaveLength(5);
    expect(
      parsed.assets.find((a) =>
        a.path.endsWith("8da26952e655f4ceeb46991fea4c4b53b4f0af69.jpg"),
      )?.bytes.length,
    ).toBe(62687995);
  },
  30000,
);

acceptanceTest(
  "keeps Test.sketch required resources, source style links, Symbols and layout details with unused resources disabled",
  async () => {
    const { h, r, index, target } = await imported({
      resourceTypes: {
        colors: false,
        layerStyles: false,
        textStyles: false,
        components: false,
        tokens: false,
      },
    });
    expect(r.state).toBe("complete");
    expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
    const details = r.validations.filter((v) =>
      [
        "stack-layout",
        "layout-limits",
        "corner-radii",
        "border-geometry",
        "component-layout",
      ].includes(v.kind),
    );
    expect(details.filter((v) => v.kind === "stack-layout")).toHaveLength(
      all.filter(
        (s) =>
          s.groupLayout?._class === "MSImmutableFlexGroupLayout" &&
          target(s.do_objectID),
      ).length,
    );
    expect(details.filter((v) => v.passed === false)).toEqual([]);
    for (const source of all) {
      if (source._class === "page") continue;
      const node = target(source.do_objectID);
      if (!node) {
        expect(
          source._class === "symbolMaster" ||
            all.some(
              (m) =>
                m._class === "symbolMaster" && walkLayers([m]).includes(source),
            ),
        ).toBe(true);
        continue;
      }
      expect(node.name).toBe(source.name);
      if (source.sharedStyleID) {
        const key =
          (source._class === "text" ? "text:" : "paint:") +
          source.sharedStyleID;
        if (source._class === "text")
          expect(index.resources[key], source.name).toBeTruthy();
        const original = document.layerTextStyles.objects.find(
          (s: any) => s.do_objectID === source.sharedStyleID,
        );
        if (source._class === "text" && original) {
          const style = h.styles.get(index.resources[key]);
          expect(style.name).toBe(original.name);
          const segments = node.getStyledTextSegments([
            "fontName",
            "fontSize",
            "lineHeight",
            "letterSpacing",
            "textDecoration",
            "textCase",
            "paragraphSpacing",
            "paragraphIndent",
            "listSpacing",
            "textWrapStyle",
            "textStyleId",
          ]);
          for (const segment of segments)
            if (
              [
                "textDecoration",
                "textCase",
                "paragraphSpacing",
                "paragraphIndent",
                "listSpacing",
                "textWrapStyle",
              ].every((key) => segment[key] === style[key]) &&
              sameFont(segment.fontName, style.fontName) &&
              segment.fontSize === style.fontSize &&
              JSON.stringify(segment.lineHeight) ===
                JSON.stringify(style.lineHeight) &&
              JSON.stringify(segment.letterSpacing) ===
                JSON.stringify(style.letterSpacing)
            )
              expect(segment.textStyleId, source.name).toBe(style.id);
        }
      }
      if (source.groupLayout?._class === "MSImmutableFlexGroupLayout") {
        expect(node.layoutMode).toBe(
          source.groupLayout.flexDirection === 0 ? "HORIZONTAL" : "VERTICAL",
        );
        expect([
          node.paddingTop,
          node.paddingRight,
          node.paddingBottom,
          node.paddingLeft,
        ]).toEqual([
          source.topPadding,
          source.rightPadding,
          source.bottomPadding,
          source.leftPadding,
        ]);
        expect(node.itemSpacing).toBe(source.groupLayout.allGuttersGap);
      }
      if (source._class === "symbolInstance")
        expect(node.main.id).toBe(
          target(
            all.find(
              (m) =>
                m._class === "symbolMaster" && m.symbolID === source.symbolID,
            )!.do_objectID,
          ).id,
        );
      for (const paint of [...(node.fills ?? []), ...(node.strokes ?? [])])
        if (paint.boundVariables?.color)
          expect(h.variables.get(paint.boundVariables.color.id)).toBeTruthy();
    }
    for (const variable of h.variables.values())
      expect(
        document.sharedSwatches.objects.some(
          (s: any) => s.name === variable.name,
        ),
      ).toBe(true);
    expect(h.variables.size).toBeLessThanOrEqual(29);
    expect(
      Object.keys(index.resources).filter((key) => key.startsWith("text:"))
        .length,
    ).toBeLessThanOrEqual(19);
  },
  30000,
);

acceptanceTest(
  "preserves original resources, literal text and exact 22/24 heading overrides in Test.sketch",
  async () => {
    const { h, r, index, target } = await imported();
    const texts = all.filter((s) => s._class === "text");
    expect(texts.filter((s) => s.sharedStyleID)).toHaveLength(116);
    expect(texts.filter((s) => !s.sharedStyleID)).toHaveLength(48);
    expect(
      [...h.styles.values()].filter((s) => s.type === "TEXT"),
    ).toHaveLength(19);
    expect(
      [...h.styles.values()].filter((s) => s.type === "PAINT"),
    ).toHaveLength(0);
    expect(
      Object.keys(index.resources).filter((key) =>
        /^(paint:|stroke:|text-override:)/.test(key),
      ),
    ).toEqual([]);
    let headings = 0;
    for (const source of texts) {
      const node = target(source.do_objectID);
      expect(node, source.name).toBeTruthy();
      for (const range of node.getStyledTextSegments(["textStyleId"])) {
        if (!source.sharedStyleID)
          expect(range.textStyleId, source.name).toBe("");
        else if (range.textStyleId)
          expect(range.textStyleId, source.name).toBe(
            index.resources[`text:${source.sharedStyleID}`],
          );
      }
      if (source.name !== "Tips for staying on") continue;
      headings++;
      expect(node.getRangeFontName(0, node.characters.length)).toEqual({
        family: "Poppins",
        style: "SemiBold",
      });
      expect(node.getRangeFontSize(0, node.characters.length)).toBe(22);
      expect(node.getRangeLineHeight(0, node.characters.length)).toEqual({
        unit: "PIXELS",
        value: 24,
      });
      expect(node.getRangeTextStyleId(0, node.characters.length)).toBe("");
      expect(
        r.validations.some(
          (v) =>
            v.sourceId === source.do_objectID &&
            v.kind === "style-binding" &&
            !v.passed,
        ),
      ).toBe(true);
    }
    expect(headings).toBe(2);
  },
  30000,
);

acceptanceTest(
  "accounts for every source-styled text range on Test.sketch pages and inside Symbols",
  async () => {
    const { h, r, index, target } = await imported();
    let linked = 0,
      literal = 0,
      bound = 0,
      reported = 0,
      instanceRanges = 0;
    for (const source of all.filter((s) => s._class === "text")) {
      const node = target(source.do_objectID);
      if (!source.sharedStyleID) {
        literal++;
        expect(node.textStyleId).toBe("");
        continue;
      }
      linked++;
      const id = index.resources[`text:${source.sharedStyleID}`],
        style = h.styles.get(id);
      expect(style).toBeTruthy();
      for (const range of textRanges(node)) {
        if (
          !textStyleDifferences(
            textRangeValues(node, range),
            textStyleValues(style),
          ).length
        )
          expect(range.textStyleId, source.name).toBe(id);
        if (range.textStyleId === id) bound++;
        else {
          reported++;
          expect(
            r.findings.some(
              (f) =>
                f.code === "TEXT_STYLE_OVERRIDE" &&
                f.sourceId === source.do_objectID &&
                f.path === `/sharedStyleID/ranges/${range.start}:${range.end}`,
            ),
            source.name,
          ).toBe(true);
        }
      }
    }
    for (const source of all.filter((s) => s._class === "symbolInstance"))
      for (const text of instanceTextSources(
        target(source.do_objectID),
        source,
      )) {
        if (!text.source.sharedStyleID) continue;
        const id = index.resources[`text:${text.source.sharedStyleID}`],
          style = h.styles.get(id);
        for (const range of textRanges(text.node)) {
          instanceRanges++;
          if (
            !textStyleDifferences(
              textRangeValues(text.node, range),
              textStyleValues(style),
            ).length
          )
            expect(range.textStyleId, text.node.name).toBe(id);
          else if (range.textStyleId !== id)
            expect(
              r.findings.some(
                (f) =>
                  f.code === "TEXT_STYLE_OVERRIDE" &&
                  f.sourceId === source.do_objectID &&
                  f.path ===
                    `/symbolID/${text.node.id}/ranges/${range.start}:${range.end}`,
              ),
              text.node.name,
            ).toBe(true);
        }
      }
    expect({ linked, literal }).toEqual({ linked: 116, literal: 48 });
    expect(bound).toBeGreaterThan(0);
    expect(reported).toBeGreaterThan(0);
    expect(instanceRanges).toBeGreaterThan(0);
  },
  30000,
);

acceptanceTest("keeps the real ISI Hug-frame height difference visible", () => {
  const source = all.find((s) => s.name === "Global/Mobile/ISI")!;
  const result = auditGeometry(source, {
    type: "COMPONENT",
    width: 375,
    height: 1574,
    relativeTransform: transform(source),
  });
  expect(result.dimensions.passed).toBe(false);
  expect(result.changedDimensions).toEqual(["height"]);
  expect(result.placement.passed).toBe(true);
});

acceptanceTest(
  "preserves all 73 real compound shapes, both source fill rules and every original contour ID",
  async () => {
    const { r, target } = await imported();
    expect(r.state).toBe("complete");
    const shapes = all.filter((s) => s._class === "shapeGroup");
    expect(shapes).toHaveLength(73);
    expect(shapes.filter((s) => s.style.windingRule === 1)).toHaveLength(55);
    expect(shapes.filter((s) => s.style.windingRule === 0)).toHaveLength(18);
    for (const s of shapes) {
      expect(s.layers.every((c: any) => c.booleanOperation === -1)).toBe(true);
      const frame = target(s.do_objectID),
        renderer = frame.children.find(
          (c: any) => c.getPluginData("sketch2figma:wrapper") === "boolean",
        );
      expect(renderer.type, s.name).toBe("VECTOR");
      expect(renderer.vectorNetwork.regions).toHaveLength(1);
      expect(renderer.vectorNetwork.regions[0].windingRule, s.name).toBe(
        s.style.windingRule === 1 ? "EVENODD" : "NONZERO",
      );
      expect(renderer.vectorNetwork.regions[0].loops.length, s.name).toBe(
        s.layers.length,
      );
      for (const child of s.layers)
        expect(target(child.do_objectID).name).toBe(child.name);
    }
    const checks = r.validations.filter((v) => v.kind === "boolean-geometry");
    expect(checks).toHaveLength(73);
    expect(checks.filter((v) => v.passed !== true)).toEqual([]);
  },
  30000,
);
