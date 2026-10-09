import type { Sketch, SketchFile } from "../src/core/types";
/** Flat swatches permit exact native pixel checks, independently of fonts. */
export function alphaFixture(): SketchFile {
  const color = (bound = false): Sketch => ({
    _class: "color",
    red: 1,
    green: 0,
    blue: 0,
    alpha: 0.5,
    ...(bound ? { swatchID: "ALPHA_COLOR" } : {}),
  });
  const rect = (id: string, x: number, fills: Sketch[]): Sketch => ({
    _class: "rectangle",
    do_objectID: id,
    name: id,
    frame: { x, y: 0, width: 30, height: 30 },
    style: { fills },
  });
  const fill = (bound: boolean, opacity = 1) => ({
    fillType: 0,
    isEnabled: true,
    color: color(bound),
    contextSettings: { opacity, blendMode: 0 },
  });
  return {
    name: "alpha-regression.sketch",
    documentId: "ALPHA_PROBE",
    version: 144,
    digest: "alpha-v1",
    meta: { version: 144 },
    user: {},
    assets: [],
    warnings: [],
    document: {
      do_objectID: "ALPHA_PROBE",
      colorSpace: 1,
      sharedSwatches: {
        objects: [
          {
            _class: "swatch",
            do_objectID: "ALPHA_COLOR",
            name: "Red / half alpha",
            value: color(),
          },
        ],
      },
    },
    pages: [
      {
        _class: "page",
        do_objectID: "ALPHA_PAGE",
        name: "Alpha regression",
        layers: [
          {
            _class: "artboard",
            do_objectID: "ALPHA_ROW",
            name: "Variable alpha, literal alpha, paint opacity, gradient alpha, fill order",
            frame: { x: 0, y: 0, width: 150, height: 30 },
            hasBackgroundColor: true,
            backgroundColor: { red: 1, green: 1, blue: 1, alpha: 1 },
            layers: [
              rect("ALPHA_BOUND", 0, [fill(true)]),
              rect("ALPHA_LITERAL", 30, [fill(false)]),
              rect("ALPHA_OPACITY", 60, [fill(true, 0.5)]),
              rect("ALPHA_GRADIENT", 90, [
                {
                  fillType: 1,
                  isEnabled: true,
                  gradient: {
                    gradientType: 0,
                    from: "{0, 0.5}",
                    to: "{1, 0.5}",
                    stops: [
                      { position: 0, color: color(true) },
                      { position: 1, color: color(true) },
                    ],
                  },
                },
              ]),
              rect("PAINT_ORDER", 120, [
                { fillType: 0, color: { red: 1, green: 0, blue: 0, alpha: 1 } },
                {
                  fillType: 0,
                  color: { red: 0, green: 0, blue: 1, alpha: 0.5 },
                },
              ]),
            ],
          },
        ],
      },
    ],
  };
}
