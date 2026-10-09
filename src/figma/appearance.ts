import { applyTiledBitmap } from "./tiled-images";
import { clamp, finite, gradientTransform } from "../core/math";
import type { Sketch } from "../core/types";
import type { ImportContext } from "./context";
const BLENDS: BlendMode[] = [
  "NORMAL",
  "DARKEN",
  "MULTIPLY",
  "COLOR_BURN",
  "LIGHTEN",
  "SCREEN",
  "COLOR_DODGE",
  "OVERLAY",
  "SOFT_LIGHT",
  "HARD_LIGHT",
  "DIFFERENCE",
  "EXCLUSION",
  "HUE",
  "SATURATION",
  "COLOR",
  "LUMINOSITY",
];
export function blend(value: number): BlendMode | undefined {
  return value === 17 ? "LINEAR_DODGE" : BLENDS[value];
}
export function colorVariable(
  ctx: ImportContext,
  s: Sketch,
  color: Sketch,
  path: string,
): Variable | undefined {
  const id = color?.swatchID;
  if (!id) return undefined;
  const variable = ctx.resources.variables.get(id);
  if (!variable)
    ctx.finding(
      "VARIABLE_REFERENCE",
      `Unresolved source color variable ${id}.`,
      s,
      `${path}/swatchID`,
      "error",
    );
  return variable;
}
export function solidPaint(
  ctx: ImportContext,
  s: Sketch,
  color: Sketch,
  path: string,
): SolidPaint {
  const c = ctx.color(color);
  let result: SolidPaint = {
    type: "SOLID",
    color: { r: c.r, g: c.g, b: c.b },
    opacity: c.a,
  };
  const variable = colorVariable(ctx, s, color, path);
  if (variable) {
    result = ctx.api.variables.setBoundVariableForPaint(
      result,
      "color",
      variable,
    );
    ctx.ledger(s).mark(`${path}/swatchID`);
  }
  ctx.ledger(s).color(path);
  return result;
}
export async function paint(
  ctx: ImportContext,
  s: Sketch,
  f: Sketch,
  path: string,
  width = 1,
  height = 1,
): Promise<Paint | null> {
  const l = ctx.ledger(s),
    base = {
      visible: f.isEnabled !== false,
      opacity: clamp(finite(f.contextSettings?.opacity, 1)),
      ...(blend(f.contextSettings?.blendMode ?? 0)
        ? { blendMode: blend(f.contextSettings?.blendMode ?? 0) }
        : {}),
    };
  let result: Paint | null = null;
  let opacityEquivalent = false;
  if (f.fillType === 0 || f.fillType === undefined) {
    const c = ctx.color(f.color);
    let p: SolidPaint = {
      type: "SOLID",
      color: { r: c.r, g: c.g, b: c.b },
      ...base,
      opacity: base.opacity * c.a,
    };
    const variable = colorVariable(ctx, s, f.color, `${path}/color`);
    if (variable) {
      p = ctx.api.variables.setBoundVariableForPaint(p, "color", variable);
      l.mark(`${path}/color/swatchID`);
    }
    if (variable && base.opacity !== 1) {
      // A COLOR binding owns SolidPaint.opacity in Figma, overriding the supplied
      // paint opacity. A constant gradient preserves both channels independently
      // without inventing a composed color variable absent from Sketch.
      const stop: ColorStop = {
        position: 0,
        color: c,
        boundVariables: {
          color: ctx.api.variables.createVariableAlias(variable),
        },
      };
      result = {
        type: "GRADIENT_LINEAR",
        gradientTransform: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        gradientStops: [stop, { ...stop, position: 1 }],
        ...base,
      };
      opacityEquivalent = true;
      ctx.finding(
        "BOUND_PAINT_OPACITY",
        "Bound color plus independent paint opacity represented by a constant native gradient. Both stops retain the original variable; no new resource created.",
        s,
        path,
        "info",
      );
    } else result = p;
    l.color(
      `${path}/color`,
      ctx.file.document.colorSpace === 2 ? "Partial" : "Native",
      "Color converted to destination document color profile; gamut clipping may occur.",
    );
  } else if (f.fillType === 1) {
    const g = f.gradient ?? {},
      types: Record<number, GradientPaint["type"]> = {
        0: "GRADIENT_LINEAR",
        1: "GRADIENT_RADIAL",
        2: "GRADIENT_ANGULAR",
      };
    if (types[g.gradientType]) {
      const stops: ColorStop[] = (g.stops ?? []).map(
        (stop: Sketch, i: number) => {
          l.fields(`${path}/gradient/stops/${i}`, ["_class", "position"]);
          l.color(`${path}/gradient/stops/${i}/color`);
          let target: ColorStop = {
            position: clamp(finite(stop.position)),
            color: ctx.color(stop.color),
          };
          const variable = colorVariable(
            ctx,
            s,
            stop.color,
            `${path}/gradient/stops/${i}/color`,
          );
          if (variable) {
            target = {
              ...target,
              boundVariables: {
                color: ctx.api.variables.createVariableAlias(variable),
              },
            };
            l.mark(`${path}/gradient/stops/${i}/color/swatchID`);
          }
          return target;
        },
      );
      if (stops.length < 2)
        throw new Error("Gradient needs at least two stops.");
      result = {
        type: types[g.gradientType],
        gradientTransform: gradientTransform(g, width, height),
        gradientStops: stops,
        ...base,
      };
      l.fields(
        `${path}/gradient`,
        ["_class", "gradientType", "from", "to", "elipseLength"],
        "Partial",
        "Native editable gradient; interpolation and radial aspect need visual validation.",
      );
    }
  } else if (f.fillType === 4 && f.image) {
    const hash = await imageHash(ctx, f.image);
    if (hash) {
      const modes: ImagePaint["scaleMode"][] = ["TILE", "FILL", "CROP", "FIT"];
      result = {
        type: "IMAGE",
        imageHash: hash,
        scaleMode: modes[f.patternFillType ?? 1] ?? "FILL",
        ...base,
        ...(f.patternFillType === 0
          ? { scalingFactor: Math.max(0.0001, finite(f.patternTileScale, 1)) }
          : {}),
        ...(f.patternFillType === 2
          ? {
              imageTransform: [
                [1, 0, 0],
                [0, 1, 0],
              ] as Transform,
            }
          : {}),
      };
      l.fields(`${path}/image`, ["_class", "_ref_class", "_ref"]);
      l.fields(path, ["patternFillType", "patternTileScale"]);
    }
  }
  if (result) {
    l.fields(path, ["_class", "isEnabled", "fillType"]);
    l.fields(`${path}/contextSettings`, ["_class", "opacity"]);
    if (opacityEquivalent) {
      l.mark(
        `${path}/fillType`,
        "Editable Equivalent",
        "Constant native gradient retains the source solid color-variable binding and independent paint opacity.",
      );
      l.mark(
        `${path}/contextSettings/opacity`,
        "Editable Equivalent",
        "Independent gradient-paint opacity multiplies the bound variable's alpha.",
      );
    }
    if (base.blendMode) l.mark(`${path}/contextSettings/blendMode`);
    else
      ctx.finding(
        "BLEND_MODE",
        `Blend mode ${f.contextSettings?.blendMode} is unsupported.`,
        s,
        `${path}/contextSettings/blendMode`,
      );
  } else
    ctx.finding(
      "PAINT_UNSUPPORTED",
      `Fill type ${f.fillType} could not be converted.`,
      s,
      path,
    );
  return result;
}
export async function imageHash(
  ctx: ImportContext,
  ref: Sketch,
): Promise<string | undefined> {
  const key = ref._ref ?? ref.sha1?._data;
  const existing = ctx.imageHashes.get(key);
  if (existing) return existing;
  let bytes = ctx.file.assets.find(
    (a) => a.path === ref._ref || a.path.startsWith(`${ref._ref}.`),
  )?.bytes;
  if (!bytes && ref.data?._data) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let acc = 0,
      bits = 0,
      out: number[] = [];
    for (const ch of ref.data._data) {
      if (ch === "=") break;
      const v = chars.indexOf(ch);
      if (v < 0) continue;
      acc = (acc << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((acc >> bits) & 255);
      }
    }
    bytes = new Uint8Array(out);
  }
  if (!bytes) {
    ctx.finding("MISSING_IMAGE", `Missing embedded asset ${ref._ref}`);
    return undefined;
  }
  try {
    const hash = ctx.api.createImage(bytes).hash;
    ctx.imageHashes.set(key, hash);
    ctx.index.assets[key] = hash;
    return hash;
  } catch (e) {
    ctx.finding("IMAGE_FORMAT", `Asset ${key}: ${e}`);
    return undefined;
  }
}
export async function effects(
  ctx: ImportContext,
  s: Sketch,
  style: Sketch,
  base = "/style",
): Promise<Effect[]> {
  const result: Effect[] = [],
    l = ctx.ledger(s);
  for (const [key, type] of [
    ["shadows", "DROP_SHADOW"],
    ["innerShadows", "INNER_SHADOW"],
  ] as const)
    for (const [i, e] of (style[key] ?? []).entries()) {
      const path = `${base}/${key}/${i}`,
        b = blend(e.contextSettings?.blendMode ?? 0);
      let target: DropShadowEffect | InnerShadowEffect = {
        type: e.isInnerShadow === true ? "INNER_SHADOW" : type,
        visible: e.isEnabled !== false,
        color: {
          ...ctx.color(e.color),
          a:
            ctx.color(e.color).a * clamp(finite(e.contextSettings?.opacity, 1)),
        },
        offset: { x: finite(e.offsetX), y: finite(e.offsetY) },
        radius: Math.max(0, finite(e.blurRadius)),
        spread: finite(e.spread),
        blendMode: b ?? "NORMAL",
      };
      const variable = colorVariable(ctx, s, e.color, `${path}/color`);
      if (variable) {
        target = ctx.api.variables.setBoundVariableForEffect(
          target,
          "color",
          variable,
        ) as DropShadowEffect | InnerShadowEffect;
        l.mark(`${path}/color/swatchID`);
      }
      result.push(target);
      l.fields(path, [
        "_class",
        "isEnabled",
        "offsetX",
        "offsetY",
        "blurRadius",
        "spread",
        "isInnerShadow",
      ]);
      l.color(`${path}/color`);
      l.fields(`${path}/contextSettings`, ["_class", "opacity"]);
      if (b) l.mark(`${path}/contextSettings/blendMode`);
    }
  const glass = s.bridge?.glass;
  if (glass) {
    result.push({
      type: "GLASS",
      visible: glass.visible !== false,
      lightIntensity: clamp(finite(glass.lightIntensity, 0.5)),
      lightAngle: finite(glass.lightAngle),
      refraction: clamp(finite(glass.refraction)),
      depth: Math.max(1, finite(glass.depth, 1)),
      dispersion: clamp(finite(glass.dispersion)),
      radius: Math.max(0, finite(glass.radius)),
    });
    l.fields(
      "/bridge/glass",
      [
        "visible",
        "lightIntensity",
        "lightAngle",
        "refraction",
        "depth",
        "dispersion",
        "radius",
      ],
      "Partial",
      "Native Glass effect from an explicit target-compatible sidecar definition; optical equivalence requires render validation.",
    );
  }
  const blurs = style.blurs ?? (style.blur ? [style.blur] : []);
  for (const [i, blur] of blurs.entries()) {
    const path = style.blurs ? `${base}/blurs/${i}` : `${base}/blur`;
    if ([0, 3].includes(blur.type)) {
      result.push({
        type: blur.type === 0 ? "LAYER_BLUR" : "BACKGROUND_BLUR",
        visible: blur.isEnabled !== false,
        blurType: "NORMAL",
        radius: Math.max(0, finite(blur.radius)),
      });
      l.fields(
        path,
        ["_class", "type", "radius", "isEnabled"],
        "Partial",
        "Native blur; Sketch/Figma blur kernels require pixel validation.",
      );
    } else if (blur.isEnabled)
      ctx.finding(
        "UNSUPPORTED_BLUR",
        `Blur type ${blur.type} retained without rasterization.`,
        s,
        path,
      );
  }
  return result;
}
function rebaseGradient(paint: Paint, t?: Transform): Paint {
  if (!t || !paint.type.startsWith("GRADIENT_")) return paint;
  const gradient = paint as GradientPaint,
    a = gradient.gradientTransform;
  return {
    ...gradient,
    gradientTransform: [
      [
        a[0][0] * t[0][0] + a[0][1] * t[1][0],
        a[0][0] * t[0][1] + a[0][1] * t[1][1],
        a[0][0] * t[0][2] + a[0][1] * t[1][2] + a[0][2],
      ],
      [
        a[1][0] * t[0][0] + a[1][1] * t[1][0],
        a[1][0] * t[0][1] + a[1][1] * t[1][1],
        a[1][0] * t[0][2] + a[1][1] * t[1][2] + a[1][2],
      ],
    ],
  };
}
export async function applyAppearance(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
  paintSpace?: { width: number; height: number; transform: Transform },
): Promise<void> {
  const st = s.style ?? {},
    l = ctx.ledger(s);
  if ("fills" in node && (node.type !== "INSTANCE" || st.fills?.length)) {
    const checkpoint = l.checkpoint();
    const paints: Paint[] = [];
    for (const [i, f] of (st.fills ?? []).entries())
      try {
        const p = await paint(
          ctx,
          s,
          f,
          `/style/fills/${i}`,
          paintSpace?.width ?? node.width,
          paintSpace?.height ?? node.height,
        );
        if (p) paints.push(p);
      } catch (e) {
        ctx.finding("FILL_FAILURE", String(e), s, `/style/fills/${i}`);
      }
    const accepted = await ctx.attempt(s, "/style/fills", () => {
      node.fills = paints.map((p) => rebaseGradient(p, paintSpace?.transform));
    });
    if (!accepted) l.rollback(checkpoint);
  }
  if ("strokes" in node && (node.type !== "INSTANCE" || st.borders?.length)) {
    const checkpoint = l.checkpoint();
    const strokes: Paint[] = [],
      borders = st.borders ?? [];
    for (const [i, b] of borders.entries())
      try {
        const p = await paint(
          ctx,
          s,
          b,
          `/style/borders/${i}`,
          paintSpace?.width ?? node.width,
          paintSpace?.height ?? node.height,
        );
        if (p) strokes.push(p);
      } catch (e) {
        ctx.finding("BORDER_FAILURE", String(e), s, `/style/borders/${i}`);
      }
    const accepted = await ctx.attempt(s, "/style/borders", () => {
      node.strokes = strokes.map((p) =>
        rebaseGradient(p, paintSpace?.transform),
      );
    });
    if (!accepted) l.rollback(checkpoint);
    const b = borders.find((v: Sketch) => v.isEnabled) || borders[0];
    if (b) {
      await ctx.attempt(
        s,
        "/style/borders/0",
        () => {
          node.strokeWeight = Math.max(0, finite(b.thickness, 1));
          node.strokeAlign =
            (["CENTER", "INSIDE", "OUTSIDE"] as const)[b.position ?? 0] ??
            "CENTER";
        },
        [],
      );
      for (const [i, v] of borders.entries()) {
        const equal = v.thickness === b.thickness && v.position === b.position;
        l.fields(
          `/style/borders/${i}`,
          ["thickness", "position"],
          equal ? "Native" : "Partial",
          equal
            ? undefined
            : "Figma strokes share width and alignment; this border uses the first active border geometry.",
        );
        if (!equal)
          ctx.finding(
            "MULTIPLE_BORDER_GEOMETRY",
            "Multiple Sketch borders use different widths/alignments; native Figma strokes share geometry.",
            s,
            `/style/borders/${i}`,
          );
      }
    }
    const bo = st.borderOptions;
    if (bo)
      await ctx.attempt(
        s,
        "/style/borderOptions",
        () => {
          node.dashPattern = bo.isEnabled ? (bo.dashPattern ?? []) : [];
          if ("strokeCap" in node)
            node.strokeCap = (["NONE", "ROUND", "SQUARE"] as const)[
              bo.lineCapStyle ?? 0
            ];
          node.strokeJoin = (["MITER", "ROUND", "BEVEL"] as const)[
            bo.lineJoinStyle ?? 0
          ];
          if ("strokeMiterLimit" in node)
            node.strokeMiterLimit = Math.max(0, finite(st.miterLimit, 4));
        },
        ["_class", "isEnabled", "lineCapStyle", "lineJoinStyle"],
      );
    if (bo?.dashPattern)
      bo.dashPattern.forEach((_: unknown, i: number) =>
        l.mark(`/style/borderOptions/dashPattern/${i}`),
      );
    l.mark("/style/miterLimit");
  }
  if (
    "effects" in node &&
    (node.type !== "INSTANCE" ||
      st.shadows?.length ||
      st.innerShadows?.length ||
      st.blur?.isEnabled ||
      s.bridge?.glass)
  )
    await ctx.attempt(s, "/style/effects", async () => {
      node.effects = await effects(ctx, s, st);
    });
  if (st.contextSettings && "opacity" in node && "blendMode" in node)
    await ctx.attempt(
      s,
      "/style/contextSettings",
      () => {
        node.opacity = clamp(finite(st.contextSettings.opacity, 1));
        const b = blend(st.contextSettings.blendMode ?? 0);
        if (b) node.blendMode = b;
        else
          ctx.finding(
            "BLEND_MODE",
            `Unsupported layer blend mode ${st.contextSettings.blendMode}`,
            s,
            "/style/contextSettings/blendMode",
          );
      },
      ["_class", "opacity"],
    );
  if (
    st.contextSettings &&
    "opacity" in node &&
    "blendMode" in node &&
    blend(st.contextSettings.blendMode ?? 0)
  )
    l.mark("/style/contextSettings/blendMode");
  l.fields(
    "/style",
    ["_class", "do_objectID"],
    "Partial",
    "Original style identity retained as metadata; compatible bindings applied separately.",
  );
  if (
    (s._class === "artboard" || s._class === "symbolMaster") &&
    s.hasBackgroundColor &&
    "fills" in node
  ) {
    node.fills = [
      solidPaint(ctx, s, s.backgroundColor, "/backgroundColor"),
      ...(typeof node.fills === "symbol" ? [] : node.fills),
    ];
    l.mark("/hasBackgroundColor");
    l.color("/backgroundColor");
  }
  if (s._class === "bitmap" && s.image && "fills" in node) {
    if (await applyTiledBitmap(ctx, s, node)) return;
    const hash = await imageHash(ctx, s.image);
    if (hash) {
      node.fills = [
        { type: "IMAGE", imageHash: hash, scaleMode: "FILL" },
        ...(typeof node.fills === "symbol" ? [] : node.fills),
      ];
      l.fields("/image", ["_class", "_ref_class", "_ref"]);
    }
  }
}
