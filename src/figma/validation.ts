import { isTextStyleBound } from "./text-style-bindings";
import { instanceTextSources } from "./instance-text-styles";
import { validateDetails } from "./detail-validation";
import { validateBooleanShape } from "./booleans";
import { overrideTarget } from "./symbols";
import {
  auditGeometry,
  GEOMETRY_TOLERANCE,
  sourceRelativeTransform,
} from "./geometry-validation";
import { sourceId, walkLayers, type Sketch } from "../core/types";
import type { ImportContext } from "./context";
export async function validateImport(
  ctx: ImportContext,
  scope: Set<string>,
): Promise<void> {
  const parents = new Map<string, Sketch>();
  for (const p of walkLayers(ctx.file.pages))
    for (const c of p.layers ?? []) parents.set(sourceId(c), p);
  const checks = ctx.report.validations,
    all = walkLayers(ctx.file.pages).filter(
      (s) => scope.has(sourceId(s)) && s._class !== "page",
    );
  for (const s of all) {
    const id = sourceId(s),
      n = ctx.nodes.get(id);
    checks.push({
      kind: "layer-exists",
      sourceId: id,
      passed: !!n && !n.removed,
      message: `${s.name}: ${n && !n.removed ? "source node has a Figma mapping" : "source node is missing from Figma"}.`,
    });
    if (!n || n.removed) continue;
    await validateDetails(ctx, s, n);
    if (s._class === "shapeGroup") validateBooleanShape(ctx, s, n);
    const geometry = auditGeometry(s, n, sourceRelativeTransform(n));
    checks.push(geometry.dimensions, geometry.placement);
    if (
      geometry.dimensions.passed === null ||
      geometry.placement.passed === null
    ) {
      const reason = geometry.dimensions.message;
      ctx
        .ledger(s)
        .fields("/frame", ["width", "height", "x", "y"], "Partial", reason);
      ctx
        .ledger(s)
        .fields(
          "",
          ["rotation", "isFlippedHorizontal", "isFlippedVertical"],
          "Partial",
          reason,
        );
      ctx.finding("GEOMETRY_UNVERIFIED", reason, s, "/frame");
    }
    if (geometry.changedDimensions.length) {
      ctx
        .ledger(s)
        .fields(
          "/frame",
          geometry.changedDimensions,
          "Partial",
          geometry.dimensions.message,
        );
      ctx.finding(
        "GEOMETRY_DIFFERENCE",
        geometry.dimensions.message,
        s,
        "/frame",
      );
    }
    if (geometry.changedPlacement.length) {
      const changed = geometry.changedPlacement,
        reason = geometry.placement.message;
      ctx.ledger(s).fields(
        "/frame",
        changed.filter((field) => field === "x" || field === "y"),
        "Partial",
        reason,
      );
      if (changed.includes("rotation") || changed.includes("skew"))
        ctx.ledger(s).mark("/rotation", "Partial", reason);
      if (changed.includes("reflection"))
        ctx
          .ledger(s)
          .fields(
            "",
            ["isFlippedHorizontal", "isFlippedVertical"],
            "Partial",
            reason,
          );
      if (changed.includes("scale"))
        ctx.ledger(s).fields("/frame", ["width", "height"], "Partial", reason);
      ctx.finding("TRANSFORM_DIFFERENCE", reason, s, "/frame");
    }
    const sourceParent = parents.get(id);
    let targetParent: BaseNode | null = n.parent;
    while (
      targetParent &&
      targetParent.type !== "PAGE" &&
      !targetParent.getPluginData("sketch2figma:sourceId")
    )
      targetParent = targetParent.parent;
    checks.push({
      kind: "hierarchy",
      sourceId: id,
      passed:
        targetParent?.getPluginData("sketch2figma:sourceId") ===
        sourceId(sourceParent ?? {}),
      expected: sourceId(sourceParent ?? {}),
      actual: targetParent?.getPluginData("sketch2figma:sourceId"),
      message: `${s.name}: nearest source-bearing parent ${targetParent?.getPluginData("sketch2figma:sourceId") === sourceId(sourceParent ?? {}) ? "matches" : "differs from"} the source parent.`,
    });
    if (s._class === "text")
      checks.push({
        kind: "text-content",
        sourceId: id,
        passed:
          "characters" in n && n.characters === s.attributedString?.string,
        expected: s.attributedString?.string,
        actual: "characters" in n ? n.characters : null,
        message: `${s.name}: editable UTF-16 text ${"characters" in n && n.characters === s.attributedString?.string ? "is preserved" : "differs or is missing"}.`,
      });
    if (s._class === "symbolInstance") {
      const master =
        n.type === "INSTANCE" ? await n.getMainComponentAsync() : null;
      const expectedComponent = ctx.resources.components.get(
        String(s.symbolID),
      );
      const linked =
        !!master && !!expectedComponent && master.id === expectedComponent.id;
      checks.push({
        kind: "component-link",
        sourceId: id,
        passed: linked,
        expected: expectedComponent?.id ?? String(s.symbolID),
        actual: master?.id,
        message: `${s.name}: ${linked ? "linked to the resolved component" : "component link differs or is missing"}.`,
      });
    }
    const appearance =
      s._class === "shapeGroup" && "children" in n
        ? (n.children.find(
            (child) =>
              child.getPluginData("sketch2figma:wrapper") === "boolean" &&
              !child.getPluginData("sketch2figma:obsolete"),
          ) ?? n)
        : n;
    if (s.sharedStyleID) {
      const id = s.sharedStyleID;
      for (const [resource, field] of [
        [ctx.resources.texts.get(id), "textStyleId"],
        [ctx.resources.effects.get(id), "effectStyleId"],
      ] as const) {
        if (!resource) continue;
        const value = (appearance as unknown as Sketch)[field];
        const passed =
          field === "textStyleId" && n.type === "TEXT"
            ? await isTextStyleBound(ctx, id, n)
            : value === resource.id;
        if (!passed) {
          ctx
            .ledger(s)
            .mark(
              "/sharedStyleID",
              "Partial",
              `${field} is not fully bound in the native host; see binding validation.`,
            );
          ctx.finding(
            "STYLE_BINDING_DIFFERENCE",
            `${s.name}: ${field} lost part or all of the source binding.`,
            s,
            "/sharedStyleID",
            "warning",
            field === "textStyleId" ? "textStyles" : "layerStyles",
          );
        }
        checks.push({
          kind: "style-binding",
          resource: field === "textStyleId" ? "textStyles" : "layerStyles",
          sourceId: sourceId(s),
          passed,
          expected: resource.id,
          actual: typeof value === "symbol" ? "mixed" : value,
          message: `${s.name}: ${field} ${passed ? "remains bound to its original source resource" : "is not fully bound to its original source resource"}.`,
        });
      }
      if (
        ![
          ctx.resources.texts,
          ctx.resources.paints,
          ctx.resources.strokes,
          ctx.resources.effects,
        ].some((m) => m.has(id))
      )
        checks.push({
          kind: "style-binding",
          sourceId: sourceId(s),
          resource: s._class === "text" ? "textStyles" : "layerStyles",
          passed: false,
          expected: id,
          message: `${s.name}: shared style is unresolved.`,
        });
    }
    validateColorBindings(ctx, s, appearance);
    if (n.type === "INSTANCE") {
      await validateOverrides(ctx, s, n);
      await validateInstanceTextStyles(ctx, s, n);
    }
    if (s.flow && "reactions" in n) {
      checks.push({
        kind: "prototype",
        sourceId: id,
        passed: n.reactions.length > 0,
        message: `${s.name}: source prototype link ${n.reactions.length ? "has an active reaction" : "has no active reaction"} (generated arrangements are reported separately).`,
      });
    }
  }
  const failedSizes = new Map(
    checks
      .filter((v) => v.kind === "geometry" && v.passed === false)
      .map((v) => [v.sourceId, v]),
  );
  for (const s of all) {
    const check = failedSizes.get(sourceId(s)),
      node = ctx.nodes.get(sourceId(s));
    if (
      !check ||
      !node ||
      !("layoutMode" in node) ||
      node.layoutMode === "NONE"
    )
      continue;
    const hugWidth = node.layoutSizingHorizontal === "HUG",
      hugHeight = node.layoutSizingVertical === "HUG";
    if (!hugWidth && !hugHeight) continue;
    const related = (s.layers ?? []).filter((child: Sketch) => {
      const mismatch = failedSizes.get(sourceId(child));
      if (!mismatch) return false;
      const expected = mismatch.expected as { width: number; height: number },
        actual = mismatch.actual as typeof expected;
      return (
        (hugWidth &&
          Math.abs(expected.width - actual.width) >=
            GEOMETRY_TOLERANCE.pixels) ||
        (hugHeight &&
          Math.abs(expected.height - actual.height) >=
            GEOMETRY_TOLERANCE.pixels)
      );
    });
    if (related.length)
      check.message += ` Auto Layout hugs ${[hugWidth && "width", hugHeight && "height"].filter(Boolean).join(" and ")}; related child size differences: ${related.map((child: Sketch) => child.name ?? sourceId(child)).join(", ")}. These checks may be related; no independent cause is inferred.`;
  }
  const mappedCount = all.filter((s) => {
    const node = ctx.nodes.get(sourceId(s));
    return !!node && !node.removed;
  }).length;
  checks.push({
    kind: "layer-count",
    passed: mappedCount === all.length,
    expected: all.length,
    actual: mappedCount,
    message: `${mappedCount} of ${all.length} selected source layers have live mappings; dependency and mask wrapper counts are separate.`,
  });
  checks.push({
    kind: "visual-pixels",
    passed: null,
    message:
      "Not run: requires an actual Sketch reference render. Native API success is not visual-fidelity proof.",
  });
  checks.push({
    kind: "responsive-layout",
    passed: null,
    message:
      "Source resize baselines are required to compare responsive behavior at multiple sizes.",
  });
}

function validateColorBindings(ctx: ImportContext, s: Sketch, n: SceneNode) {
  const check = (
    color: Sketch,
    actual: VariableAlias | undefined,
    path: string,
  ) => {
    if (!color?.swatchID) return;
    const expected = ctx.resources.variables.get(color.swatchID)?.id;
    ctx.report.validations.push({
      kind: "variable-binding",
      sourceId: sourceId(s),
      passed: !!expected && actual?.id === expected,
      expected,
      actual: actual?.id,
      message: `${s.name}: ${path} ${expected && actual?.id === expected ? "retains its color-variable binding" : "has a missing or different color-variable binding"}.`,
    });
  };
  for (const [key, field] of [
    ["fills", "fills"],
    ["borders", "strokes"],
  ] as const) {
    if (!(field in n)) continue;
    const paints = (n as unknown as Sketch)[field];
    if (typeof paints === "symbol") continue;
    for (const [i, fill] of (s.style?.[key] ?? []).entries()) {
      const p = paints?.[i];
      if (fill.fillType === 0 || fill.fillType === undefined)
        check(
          fill.color,
          p?.boundVariables?.color ??
            (p?.gradientStops?.length === 2 &&
            p.gradientStops.every(
              (stop: ColorStop) =>
                stop.boundVariables?.color?.id ===
                p.gradientStops[0].boundVariables?.color?.id,
            )
              ? p.gradientStops[0].boundVariables?.color
              : undefined),
          `${key}/${i}`,
        );
      else if (fill.fillType === 1)
        for (const [j, stop] of (fill.gradient?.stops ?? []).entries())
          check(
            stop.color,
            p?.gradientStops?.[j]?.boundVariables?.color,
            `${key}/${i}/gradient/${j}`,
          );
    }
  }
  if ("effects" in n) {
    let offset = 0;
    for (const key of ["shadows", "innerShadows"])
      for (const effect of s.style?.[key] ?? []) {
        const target = n.effects[offset++];
        check(
          effect.color,
          target &&
            (target.type === "DROP_SHADOW" || target.type === "INNER_SHADOW")
            ? target.boundVariables?.color
            : undefined,
          key,
        );
      }
  }
  if (n.type === "TEXT") {
    const base =
      s.style?.textStyle?.encodedAttributes?.MSAttributedStringColorAttribute;
    const get = (a: number, b: number) => {
      const fills = n.getRangeFills(a, b);
      return typeof fills === "symbol"
        ? undefined
        : fills[0]?.type === "SOLID"
          ? fills[0].boundVariables?.color
          : undefined;
    };
    if (
      n.characters.length &&
      !(s.style?.fills ?? []).some((f: Sketch) => f.isEnabled !== false)
    ) {
      const runs = s.attributedString?.attributes ?? [];
      if (!runs.length) check(base, get(0, n.characters.length), "text color");
      for (const r of runs)
        if (
          r.length > 0 &&
          r.location >= 0 &&
          r.location + r.length <= n.characters.length
        )
          check(
            r.attributes?.MSAttributedStringColorAttribute ?? base,
            get(r.location, r.location + r.length),
            "text run color",
          );
    }
  }
}
async function validateOverrides(
  ctx: ImportContext,
  s: Sketch,
  n: InstanceNode,
) {
  for (const o of s.overrideValues ?? []) {
    const m = String(o.overrideName).match(/^(.*)_([^_]+)$/);
    if (!m) continue;
    const target = overrideTarget(n, m[1].split("/"));
    let passed: boolean | undefined;
    if (m[2] === "stringValue")
      passed =
        !!target &&
        "characters" in target &&
        target.characters === String(o.value);
    if (m[2] === "isVisible")
      passed =
        target?.visible ===
        (o.value !== false && o.value !== 0 && o.value !== "0");
    if (m[2] === "symbolID")
      passed =
        o.value === ""
          ? target?.visible === false
          : !!ctx.resources.components.get(String(o.value)) &&
            target?.type === "INSTANCE" &&
            (await target.getMainComponentAsync())?.id ===
              ctx.resources.components.get(String(o.value))?.id;
    if (passed !== undefined)
      ctx.report.validations.push({
        kind: "component-override",
        sourceId: sourceId(s),
        passed,
        expected: o.value,
        actual: !target
          ? null
          : m[2] === "stringValue" && "characters" in target
            ? target.characters
            : m[2] === "isVisible"
              ? target.visible
              : target.type === "INSTANCE"
                ? (await target.getMainComponentAsync())?.getPluginData(
                    "sketch2figma:sourceId",
                  )
                : null,
        message: `${s.name}: ${o.overrideName} ${passed ? "matches" : "differs from"} the source override.`,
      });
  }
}

/** Component text must be checked in its actual instance, not only in the master. */
async function validateInstanceTextStyles(
  ctx: ImportContext,
  source: Sketch,
  instance: InstanceNode,
): Promise<void> {
  for (const { node, source: original } of instanceTextSources(
    instance,
    source,
  )) {
    const sourceStyleId = original.sharedStyleID;
    if (!sourceStyleId) continue;
    const ranges = node.getStyledTextSegments(["textStyleId"]);
    const passed = await isTextStyleBound(ctx, sourceStyleId, node);
    ctx.report.validations.push({
      kind: "instance-text-style-binding",
      sourceId: sourceId(source),
      expected: {
        sourceTextId: sourceId(original),
        sourceStyleId,
        styleId: ctx.resources.texts.get(sourceStyleId)?.id,
      },
      actual: {
        targetId: node.id,
        ranges: ranges.map(({ start, end, textStyleId }) => ({
          start,
          end,
          textStyleId,
        })),
        emptyTextStyleId: node.characters.length
          ? undefined
          : typeof node.textStyleId === "symbol"
            ? "mixed"
            : node.textStyleId,
      },
      passed,
      message: `${source.name} / ${node.name}: instance text ${passed ? "is bound" : "is not fully bound"} to its effective original source style.`,
    });
    if (!passed) {
      ctx.finding(
        "INSTANCE_TEXT_STYLE_BINDING",
        `${source.name} / ${node.name}: one or more text ranges are not bound to source style ${sourceStyleId} with its exact source overrides.`,
        source,
        "/symbolID",
      );
      ctx
        .ledger(source)
        .mark(
          "/symbolID",
          "Partial",
          "Native component link exists, but instance text has unbound source style ranges; see instance-text-style-binding checks.",
        );
    }
  }
}
