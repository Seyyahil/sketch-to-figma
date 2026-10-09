import { point, finite } from "../core/math";
import { sourceId, type Sketch } from "../core/types";
import type { ImportContext } from "./context";

/** Read back the finished document; successful setter calls alone are not acceptance. */
export async function validateDetails(
  ctx: ImportContext,
  source: Sketch,
  node: SceneNode,
): Promise<void> {
  const target = node as unknown as Sketch;
  const supplied = new Set(
    (ctx.options.tokens?.bindings ?? [])
      .filter((b) => b.sourceId === sourceId(source))
      .map((b) => b.field),
  );
  const check = (kind: string, values: Sketch, path: string) => {
    const expected: Sketch = {},
      actual: Sketch = {};
    for (const [field, value] of Object.entries(values)) {
      // Explicit token values can replace source literals. Their aliases have separate binding checks.
      if (supplied.has(field)) continue;
      expected[field] = value;
      actual[field] = target[field];
    }
    if (!Object.keys(expected).length) return;
    const changed = Object.keys(expected).filter((key) =>
      typeof expected[key] === "number" && typeof actual[key] === "number"
        ? !Number.isFinite(expected[key]) ||
          !Number.isFinite(actual[key]) ||
          Math.abs(expected[key] - actual[key]) > 0.01
        : expected[key] !== actual[key],
    );
    ctx.report.validations.push({
      kind,
      sourceId: sourceId(source),
      expected,
      actual,
      passed: !changed.length,
      message: `${source.name}: ${kind} ${changed.length ? `readback differs in ${changed.join(", ")}` : "readback matches source"}.`,
    });
    if (changed.length) {
      ctx
        .ledger(source)
        .mark(
          path,
          "Partial",
          `Native readback differs in ${changed.join(", ")}; see ${kind} validation.`,
        );
      ctx.finding(
        "DETAIL_DIFFERENCE",
        `${source.name}: ${kind} differs in ${changed.join(", ")}.`,
        source,
        path,
      );
    }
  };
  const g = source.groupLayout;
  if (g?._class === "MSImmutableFlexGroupLayout" && "layoutMode" in node) {
    const values: Sketch = {
      layoutMode: g.flexDirection === 0 ? "HORIZONTAL" : "VERTICAL",
      layoutWrap: g.wrappingEnabled ? "WRAP" : "NO_WRAP",
      paddingTop: finite(source.topPadding),
      paddingRight: finite(source.rightPadding),
      paddingBottom: finite(source.bottomPadding),
      paddingLeft: finite(source.leftPadding),
      itemSpacing: finite(g.allGuttersGap),
    };
    if (g.wrappingEnabled)
      values.counterAxisSpacing = finite(g.crossAxisGutterGap);
    if ([0, 1].includes(g.stackingOrder))
      values.itemReverseZIndex = g.stackingOrder === 0;
    if (typeof g.bordersAffectLayout === "boolean")
      values.strokesIncludedInLayout = g.bordersAffectLayout;
    check("stack-layout", values, "/groupLayout");
  }
  if (
    node.parent &&
    "layoutMode" in node.parent &&
    node.parent.layoutMode !== "NONE"
  )
    for (const [key, width, height] of [
      ["minSize", "minWidth", "minHeight"],
      ["maxSize", "maxWidth", "maxHeight"],
    ] as const) {
      if (source[key] === undefined || !(width in node)) continue;
      try {
        const size = point(source[key]);
        check(
          "layout-limits",
          { [width]: size.x || null, [height]: size.y || null },
          `/${key}`,
        );
      } catch (error) {
        ctx.finding(
          "VALIDATION_SOURCE",
          String(error),
          source,
          `/${key}`,
          "error",
        );
      }
    }
  const corners = source.style?.corners;
  if (
    corners?.radii?.length &&
    [0, 1].includes(corners.style) &&
    "topLeftRadius" in node
  ) {
    const fields = [
      "topLeftRadius",
      "topRightRadius",
      "bottomRightRadius",
      "bottomLeftRadius",
    ];
    check(
      "corner-radii",
      Object.fromEntries(
        fields.map((field, i) => [
          field,
          corners.radii[i % corners.radii.length],
        ]),
      ),
      "/style/corners",
    );
  }
  const borders = source.style?.borders,
    border = borders?.find((b: Sketch) => b.isEnabled) ?? borders?.[0];
  if (
    border &&
    "strokeWeight" in node &&
    [0, 1, 2].includes(border.position ?? 0)
  )
    check(
      "border-geometry",
      {
        strokeWeight: Math.max(0, finite(border.thickness, 1)),
        strokeAlign: ["CENTER", "INSIDE", "OUTSIDE"][border.position ?? 0],
      },
      "/style/borders",
    );
  if (node.type === "INSTANCE") {
    const main = await node.getMainComponentAsync();
    if (!main || main.layoutMode === "NONE") return;
    const fields = [
      "layoutMode",
      "layoutWrap",
      "itemSpacing",
      "counterAxisSpacing",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "primaryAxisAlignItems",
      "counterAxisAlignItems",
      "itemReverseZIndex",
      "strokesIncludedInLayout",
    ] as const;
    check(
      "component-layout",
      Object.fromEntries(fields.map((field) => [field, main[field]])),
      "/symbolID",
    );
    for (const field of fields) {
      const alias = (main.boundVariables as Sketch)?.[field];
      if (
        !alias ||
        Array.isArray(alias) ||
        alias.type !== "VARIABLE_ALIAS" ||
        supplied.has(field)
      )
        continue;
      const actual = (node.boundVariables as Sketch)?.[field];
      const passed = actual?.id === alias.id;
      ctx.report.validations.push({
        kind: "component-layout-binding",
        sourceId: sourceId(source),
        expected: alias.id,
        actual: actual?.id,
        passed,
        message: `${source.name}: inherited ${field} variable ${passed ? "remains bound" : "is missing or bound to a different variable"}.`,
      });
      if (!passed) {
        ctx
          .ledger(source)
          .mark(
            "/symbolID",
            "Partial",
            `Inherited ${field} variable binding differs from the component.`,
          );
        ctx.finding(
          "COMPONENT_LAYOUT_BINDING",
          `${source.name}: inherited ${field} binding was not retained.`,
          source,
          "/symbolID",
        );
      }
    }
  }
}
