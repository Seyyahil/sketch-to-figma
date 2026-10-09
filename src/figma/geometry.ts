import {
  constraints,
  finite,
  pathData,
  transform,
  vectorNetwork,
} from "../core/math";
import type { Sketch } from "../core/types";
import { tiledAsset } from "./tiled-images";
import type { ImportContext } from "./context";
export function createNode(ctx: ImportContext, s: Sketch): SceneNode {
  const api = ctx.api;
  switch (s._class) {
    case "symbolMaster":
      return api.createComponent();
    case "text":
      return api.createText();
    case "rectangle":
      if (!s.edited) return api.createRectangle();
      return api.createVector();
    case "oval":
      if (!s.edited) return api.createEllipse();
      return api.createVector();
    case "bitmap":
      if (tiledAsset(ctx, s.image)) {
        const frame = api.createFrame();
        frame.fills = [];
        frame.clipsContent = false;
        return frame;
      }
      return api.createRectangle();
    case "slice":
      return api.createSlice();
    case "shapePath":
    case "polygon":
    case "star":
    case "triangle":
      return api.createVector();
    default: {
      const n = api.createFrame();
      n.fills = [];
      n.clipsContent = s._class === "artboard" || s.clipsContents === true;
      return n;
    }
  }
}
export async function applyGeometry(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
): Promise<void> {
  const l = ctx.ledger(s),
    f = s.frame ?? {};
  await ctx.attempt(
    s,
    "/frame",
    () => {
      if ("resize" in node)
        node.resize(
          Math.max(0.01, finite(f.width, 1)),
          Math.max(0.01, finite(f.height, 1)),
        );
    },
    ["_class", "width", "height"],
    f.width === 0 || f.height === 0 ? "Partial" : "Native",
    "Zero dimensions are clamped to 0.01 where Figma requires positive bounds.",
  );
  const transformed = await ctx.attempt(s, "/transform", () => {
    node.relativeTransform = transform(s);
  });
  if (transformed) {
    l.fields("/frame", ["x", "y"]);
    l.fields("", ["rotation", "isFlippedHorizontal", "isFlippedVertical"]);
  }
  if ("clipsContent" in node && s.clippingBehavior !== undefined) {
    node.clipsContent =
      s.clippingBehavior === 1 ||
      (s.clippingBehavior === 0 &&
        (s.groupBehavior === 1 || s._class === "symbolMaster"));
    l.mark("/clippingBehavior");
  }
  if (
    "constraints" in node &&
    s.hasExplicitConstraints &&
    s.horizontalPins !== undefined
  ) {
    const axis = (pins: number, sizing: number): ConstraintType =>
      pins === 5
        ? "STRETCH"
        : pins & 1
          ? "MIN"
          : pins & 4
            ? "MAX"
            : sizing === 3
              ? "SCALE"
              : "CENTER";
    node.constraints = {
      horizontal: axis(s.horizontalPins, s.horizontalSizing),
      vertical: axis(s.verticalPins, s.verticalSizing),
    };
    l.fields("", ["horizontalPins", "verticalPins", "hasExplicitConstraints"]);
  } else if ("constraints" in node)
    await ctx.attempt(s, "/resizingConstraint", () => {
      node.constraints = constraints(s.resizingConstraint);
    });
  if ("constrainProportions" in node && f.constrainProportions !== undefined)
    await ctx.attempt(s, "/frame/constrainProportions", () => {
      node.constrainProportions = f.constrainProportions;
    });
  await ctx.attempt(s, "/name", () => {
    node.name = s.name ?? s._class;
  });
  if (s.isVisible !== undefined)
    await ctx.attempt(s, "/isVisible", () => {
      node.visible = !!s.isVisible;
    });
  if (s.isLocked !== undefined)
    await ctx.attempt(s, "/isLocked", () => {
      node.locked = !!s.isLocked;
    });
  l.mark(
    "/do_objectID",
    "Native",
    "Source identity persisted in plugin metadata.",
  );
  const nativeTypes: Record<string, string> = {
    symbolMaster: "COMPONENT",
    symbolInstance: "INSTANCE",
    text: "TEXT",
    rectangle: "RECTANGLE",
    oval: "ELLIPSE",
    slice: "SLICE",
    artboard: "FRAME",
    group: "GROUP",
    shapeGroup: "BOOLEAN_OPERATION",
    shapePath: "VECTOR",
  };
  const recognized = [
    ...Object.keys(nativeTypes),
    "bitmap",
    "polygon",
    "star",
    "triangle",
    "frame",
    "graphic",
  ].includes(s._class);
  if (recognized)
    l.mark(
      "/_class",
      nativeTypes[s._class] === node.type ? "Native" : "Editable Equivalent",
      "Editable target type recorded independently of visual fidelity.",
    );
  else
    ctx.finding(
      "LAYER_TYPE",
      `Unsupported source layer type ${s._class}; editable bounds placeholder and original metadata retained.`,
      s,
      "/_class",
      "error",
    );
  if (node.type === "VECTOR" && s.points?.length) {
    const ok = await ctx.attempt(s, "/points", async () => {
      await node.setVectorNetworkAsync(vectorNetwork(s));
    });
    if (ok) {
      for (const [i, p] of s.points.entries()) {
        l.fields(`/points/${i}`, [
          "_class",
          "point",
          "curveFrom",
          "curveTo",
          "hasCurveFrom",
          "hasCurveTo",
          "curveMode",
        ]);
        if ((p.cornerStyle ?? 0) === 0)
          l.fields(`/points/${i}`, ["cornerRadius", "cornerStyle"]);
        else
          ctx.finding(
            "VECTOR_CORNER",
            "Non-round vector corner style retained; native vector corner radius cannot reproduce it.",
            s,
            `/points/${i}/cornerStyle`,
          );
      }
      l.mark("/isClosed");
      l.mark("/style/windingRule");
    }
  }

  if (node.type === "RECTANGLE" && s.points?.length === 4) {
    const radii = s.points.map((p: Sketch) =>
      Math.max(0, finite(p.cornerRadius)),
    );
    if (s.points.every((p: Sketch) => (p.cornerStyle ?? 0) === 0)) {
      node.topLeftRadius = radii[0];
      node.topRightRadius = radii[1];
      node.bottomRightRadius = radii[2];
      node.bottomLeftRadius = radii[3];
      s.points.forEach((_: Sketch, i: number) =>
        l.fields(`/points/${i}`, ["cornerRadius", "cornerStyle"]),
      );
    } else
      ctx.finding(
        "CORNER_STYLE",
        "Non-round rectangle corner styles retained; native rectangle cannot reproduce them.",
        s,
        "/points",
      );
  }
  const corners = s.style?.corners;
  if (corners && "topLeftRadius" in node && corners.radii?.length) {
    if (corners.style === 0 || corners.style === 1) {
      const radii = corners.radii;
      node.topLeftRadius = radii[0];
      node.topRightRadius = radii[1 % radii.length];
      node.bottomRightRadius = radii[2 % radii.length];
      node.bottomLeftRadius = radii[3 % radii.length];
      if ("cornerSmoothing" in node)
        node.cornerSmoothing =
          corners.style === 1 ? finite(corners.smoothing) : 0;
      l.fields(
        "/style/corners",
        ["_class", "style"],
        corners.style === 1 ? "Partial" : "Native",
        corners.style === 1
          ? "Native smoothing may use a different curve."
          : undefined,
      );
      radii.forEach((_: unknown, i: number) =>
        l.mark(`/style/corners/radii/${i}`),
      );
      if (corners.smoothing !== undefined)
        l.mark(
          "/style/corners/smoothing",
          corners.style === 1 ? "Partial" : "Native",
        );
      if (corners.prefersConcentric)
        ctx.finding(
          "CONCENTRIC_CORNERS",
          "Concentric corner behavior has no live native equivalent; serialized radii retained.",
          s,
          "/style/corners/prefersConcentric",
        );
      else l.mark("/style/corners/prefersConcentric");
    } else
      ctx.finding(
        "CORNER_STYLE",
        `Corner style ${corners.style} has no native radius equivalent.`,
        s,
        "/style/corners/style",
      );
  }
  if ("exportSettings" in node) {
    const checkpoint = l.checkpoint();
    const settings: ExportSettings[] = [];
    for (const [i, e] of (s.exportOptions?.exportFormats ?? []).entries()) {
      const path = `/exportOptions/exportFormats/${i}`,
        format = String(e.fileFormat).toUpperCase();
      if (["PNG", "JPG"].includes(format)) {
        settings.push({
          format: format as "PNG" | "JPG",
          suffix: e.namingScheme === 0 ? (e.name ?? "") : "",
          constraint: {
            type:
              e.visibleScaleType === 1
                ? "WIDTH"
                : e.visibleScaleType === 2
                  ? "HEIGHT"
                  : "SCALE",
            value: e.visibleScaleType
              ? Math.max(0.01, finite(e.absoluteSize, 1))
              : Math.max(0.01, finite(e.scale, 1)),
          },
        });
      } else if (format === "SVG")
        settings.push({
          format: "SVG",
          suffix: e.namingScheme === 0 ? (e.name ?? "") : "",
        });
      else if (format === "PDF")
        settings.push({
          format: "PDF",
          suffix: e.namingScheme === 0 ? (e.name ?? "") : "",
        });
      else {
        ctx.finding(
          "EXPORT_FORMAT",
          `Unsupported export format ${format}.`,
          s,
          path,
        );
        continue;
      }
      l.fields(path, [
        "_class",
        "fileFormat",
        "scale",
        "absoluteSize",
        "visibleScaleType",
      ]);
      l.fields(
        path,
        ["name", "namingScheme"],
        e.namingScheme && e.name ? "Partial" : "Native",
        "Figma export settings support suffixes; Sketch prefixes remain source metadata.",
      );
    }
    const accepted = await ctx.attempt(
      s,
      "/exportOptions/exportFormats",
      () => {
        node.exportSettings = settings;
      },
    );
    if (!accepted) l.rollback(checkpoint);
  }
}
