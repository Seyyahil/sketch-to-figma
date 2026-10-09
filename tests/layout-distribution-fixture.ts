import type { Sketch, SketchFile } from "../src/core/types";
/** Actual Sketch serialized enums; positions independently encode expected flow. */
export function layoutDistributionFixture(): SketchFile {
  const layers: Sketch[] = [];
  for (const vertical of [false, true])
    for (const distribution of [4, 5]) {
      const id = `DISTRIBUTION_${vertical ? "V" : "H"}_${distribution}`;
      const positions = distribution === 4 ? [20, 80, 140] : [30, 80, 130];
      layers.push({
        _class: "group",
        do_objectID: id,
        name: id,
        frame: {
          x: layers.length * 220,
          y: 0,
          width: vertical ? 24 : 180,
          height: vertical ? 180 : 24,
        },
        horizontalSizing: 0,
        verticalSizing: 0,
        leftPadding: 0,
        rightPadding: 0,
        topPadding: 0,
        bottomPadding: 0,
        groupLayout: {
          _class: "MSImmutableFlexGroupLayout",
          flexDirection: vertical ? 1 : 0,
          justifyContent: distribution,
          alignItems: 0,
          allGuttersGap: 0,
          wrappingEnabled: false,
        },
        layers: positions
          .map((pos, i) => ({
            _class: "rectangle",
            do_objectID: `${id}_${i}`,
            name: `Item ${i + 1}`,
            frame: {
              x: vertical ? 0 : pos,
              y: vertical ? pos : 0,
              width: 20,
              height: 20,
            },
            horizontalSizing: 0,
            verticalSizing: 0,
            flexItem: {
              _class: "MSImmutableFlexItem",
              alignSelf: 5,
              ignoreLayout: false,
            },
          }))
          .reverse(),
      });
    }
  return {
    name: "layout-distribution-regression.sketch",
    documentId: "LAYOUT",
    version: 196,
    digest: "distribution-regression-v1",
    meta: { version: 196 },
    user: {},
    assets: [],
    warnings: [],
    document: { do_objectID: "LAYOUT", colorSpace: 1 },
    pages: [
      {
        _class: "page",
        do_objectID: "LP",
        name: "Layout distribution regression",
        layers,
      },
    ],
  };
}
