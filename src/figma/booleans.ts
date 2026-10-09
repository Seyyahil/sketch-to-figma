import {
  hasImplicitClosingEdge,
  joinContours,
  mapNetwork,
  shapeOperation,
  sourceContours,
  windingRule,
} from "../core/compound-paths";
import { finite } from "../core/math";
import { sourceId, type Sketch } from "../core/types";
import { applyAppearance } from "./appearance";
import type { ImportContext } from "./context";
import {
  GEOMETRY_TOLERANCE,
  multiplyTransforms,
  networkBounds,
} from "./geometry-validation";

const identity: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];
const ownerKey = "sketch2figma:shapeOwner";
type Operand = { source?: Sketch; node: SceneNode };
function relativeTo(node: SceneNode, parent: SceneNode): Transform {
  let t = node.relativeTransform,
    p = node.parent;
  while (p && p.id !== parent.id && "relativeTransform" in p) {
    t = multiplyTransforms(p.relativeTransform, t);
    p = p.parent;
  }
  if (p?.id !== parent.id)
    throw new Error("Boolean operand is outside its source container");
  return t;
}
function owned(ctx: ImportContext, s: Sketch, n: SceneNode, kind: string) {
  n.name = s.name ?? s._class;
  n.setPluginData("sketch2figma:documentId", ctx.file.documentId);
  n.setPluginData(ownerKey, sourceId(s));
  n.setPluginData("sketch2figma:wrapper", kind);
}
async function retire(
  ctx: ImportContext,
  s: Sketch,
  parent: FrameNode,
  keep: Set<string>,
) {
  for (const n of [...parent.children]) {
    if (keep.has(n.id) || n.getPluginData("sketch2figma:sourceId")) continue;
    if (n.getPluginData("sketch2figma:documentId") !== ctx.file.documentId)
      continue;
    if (
      n.getPluginData(ownerKey) !== sourceId(s) &&
      n.getPluginData("sketch2figma:wrapper") !== "boolean"
    )
      continue;
    if (
      "children" in n &&
      n.findAll((c) => !!c.getPluginData("sketch2figma:sourceId")).length
    )
      continue;
    await ctx.journal.before(n);
    n.visible = false;
    n.setPluginData("sketch2figma:obsolete", "true");
    ctx.cleanup.add(n);
  }
}
/** Keep old auto-sized containers alive until commit. Native hosts may remove
 * a group when its last operand leaves, which would make rollback impossible. */
export async function prepareBooleanRebuild(
  ctx: ImportContext,
  s: Sketch,
  operands: SceneNode[],
): Promise<void> {
  const containers = new Map<string, GroupNode | BooleanOperationNode>();
  for (const operand of operands) {
    let parent = operand.parent;
    while (parent && !parent.getPluginData("sketch2figma:sourceId")) {
      if (
        (parent.type === "BOOLEAN_OPERATION" || parent.type === "GROUP") &&
        parent.getPluginData("sketch2figma:documentId") === ctx.file.documentId
      )
        containers.set(parent.id, parent);
      parent = parent.parent;
    }
  }
  for (const container of containers.values()) {
    await ctx.journal.before(container);
    const guard = ctx.api.createVector();
    ctx.journal.track(guard);
    guard.name = s.name;
    guard.visible = false;
    guard.fills = [];
    guard.strokes = [];
    container.appendChild(guard);
  }
}
/** Never flatten imported operands. If a previously evaluated native boolean
 * needs to become a contour, resolve a disposable CLONE and retain the original. */
async function resolvedNetwork(
  ctx: ImportContext,
  parent: FrameNode,
  operand: Operand,
  rule: WindingRule,
): Promise<VectorNetwork> {
  if (operand.source) {
    try {
      return sourceContours(operand.source, rule);
    } catch (error) {
      if (
        operand.source._class !== "shapeGroup" &&
        operand.source.points?.length
      )
        throw error;
    }
  }
  const geometry =
    operand.source?._class === "shapeGroup" && "children" in operand.node
      ? (operand.node.children.find(
          (n) =>
            n.getPluginData("sketch2figma:wrapper") === "boolean" &&
            !n.getPluginData("sketch2figma:obsolete"),
        ) ?? operand.node)
      : operand.node;
  const t = relativeTo(geometry, parent),
    clone = geometry.clone();
  ctx.journal.track(clone);
  parent.appendChild(clone);
  clone.relativeTransform = t;
  const clearIds = (n: SceneNode) => {
    n.setPluginData("sketch2figma:sourceId", "");
    if ("children" in n) for (const c of n.children) clearIds(c);
  };
  clearIds(clone);
  // Evaluate the filled area, independently of a source operand's paint/stroke.
  if ("fills" in clone && clone.type !== "FRAME")
    clone.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  if ("strokes" in clone) clone.strokes = [];
  if ("effects" in clone) clone.effects = [];
  if ("opacity" in clone) clone.opacity = 1;
  const vector = ctx.api.flatten([clone], parent);
  ctx.journal.track(vector);
  try {
    const network = vector.vectorNetwork;
    if ((network.regions ?? []).some((r) => r.windingRule !== "NONZERO"))
      throw new Error(
        "Native resolved contours do not expose a compatible nonzero winding representation",
      );
    return mapNetwork(network, relativeTo(vector, parent));
  } finally {
    vector.remove();
  }
}
async function compound(
  ctx: ImportContext,
  s: Sketch,
  parent: FrameNode,
  operands: Operand[],
  rule: WindingRule,
): Promise<VectorNode> {
  const networks: VectorNetwork[] = [];
  for (const o of operands) {
    if (ctx.cancelled) throw new Error("IMPORT_CANCELLED");
    networks.push(await resolvedNetwork(ctx, parent, o, rule));
  }
  const network = joinContours(networks, rule),
    result = ctx.api.createVector();
  ctx.journal.track(result);
  parent.appendChild(result);
  owned(ctx, s, result, "boolean");
  result.setPluginData("sketch2figma:shapeRepresentation", "compound");
  result.setPluginData(
    "sketch2figma:contourSources",
    JSON.stringify(
      operands.map((o) =>
        o.source
          ? sourceId(o.source)
          : o.node.getPluginData("sketch2figma:contourSources"),
      ),
    ),
  );
  if (network.vertices.length) {
    const bounds = networkBounds(network);
    await result.setVectorNetworkAsync(
      mapNetwork(network, [
        [1, 0, -bounds.x],
        [0, 1, -bounds.y],
      ]),
    );
    const nativeBounds = networkBounds(result.vectorNetwork);
    result.relativeTransform = [
      [1, 0, bounds.x - nativeBounds.x],
      [0, 1, bounds.y - nativeBounds.y],
    ];
  } else {
    await result.setVectorNetworkAsync(network);
    result.visible = false;
  }
  const originals = ctx.api.createFrame();
  ctx.journal.track(originals);
  parent.appendChild(originals);
  owned(ctx, s, originals, "compound-sources");
  originals.fills = [];
  originals.clipsContent = false;
  originals.visible = false;
  originals.resize(Math.max(0.01, parent.width), Math.max(0.01, parent.height));
  originals.relativeTransform = identity;
  for (const o of operands) {
    await ctx.journal.before(o.node);
    const t = relativeTo(o.node, parent);
    originals.appendChild(o.node);
    o.node.relativeTransform = t;
  }
  const reason =
    "Editable compound vector uses the source fill rule. Original contour layers and IDs are retained in a hidden container; editing those retained operands does not update the rendered compound automatically.";
  ctx.ledger(s).mark("/_class", "Editable Equivalent", reason);
  ctx.finding("COMPOUND_EDITABILITY", reason, s, "/layers", "info");
  for (const o of operands)
    if (o.source)
      ctx
        .ledger(o.source)
        .mark("/booleanOperation", "Editable Equivalent", reason);
  if (
    operands.some((o) => o.source && hasImplicitClosingEdge(o.source)) &&
    (s.style?.borders ?? []).some((b: Sketch) => b.isEnabled !== false)
  ) {
    ctx.finding(
      "COMPOUND_OPEN_STROKE",
      "Implicit fill closure is native, but a compound's open-path border may include the closing edge. Original open contour geometry is retained.",
      s,
      "/style/borders",
    );
    ctx
      .ledger(s)
      .mark(
        "/_class",
        "Partial",
        "Open-path compound border closure differs; see COMPOUND_OPEN_STROKE.",
      );
  }
  return result;
}
/** Sketch operand contours can have no paint; native Figma booleans now use
 * fill/stroke geometry. A neutral operative fill keeps those closed contours
 * active. It is internal geometry, never a generated color/style resource. */
async function operativeGeometry(
  ctx: ImportContext,
  node: SceneNode,
  source?: Sketch,
): Promise<void> {
  // Sketch's boolean evaluator interprets operand paths with parity before
  // emitting the final oriented contours. Confirmed with Sketch CLI exports of
  // self-overlapping operands under both group fill rules. Pure None compounds
  // never enter this branch and retain their source winding rule unchanged.
  if (
    node.type === "VECTOR" &&
    node.vectorNetwork.regions?.some((r) => r.windingRule !== "EVENODD")
  ) {
    await ctx.journal.before(node);
    const network = node.vectorNetwork;
    await node.setVectorNetworkAsync({
      ...network,
      regions: network.regions!.map((r) => ({ ...r, windingRule: "EVENODD" })),
    });
    if (source) {
      const reason =
        "Operand contours use parity for native boolean evaluation, matching Sketch's boolean clipping. The original standalone fill rule is retained in source metadata.";
      ctx
        .ledger(source)
        .mark("/style/windingRule", "Editable Equivalent", reason);
      ctx.finding(
        "BOOLEAN_OPERAND_WINDING",
        reason,
        source,
        "/style/windingRule",
        "info",
      );
    }
  }
  if (!("fills" in node) || typeof node.fills === "symbol") return;
  const filled = node.fills.some((paint) => paint.visible !== false),
    stroked =
      "strokes" in node &&
      node.strokes.some((paint) => paint.visible !== false);
  if (filled || stroked) return;
  await ctx.journal.before(node);
  node.fills = [...node.fills, { type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  node.setPluginData("sketch2figma:booleanGeometryFill", "true");
  if (source) {
    const reason =
      "Unpainted Sketch operand receives an internal geometry fill for native boolean evaluation; the combined shape owns the visible paint. Original paint definitions remain in source metadata.";
    ctx.ledger(source).mark("/style/fills", "Editable Equivalent", reason);
    ctx.finding(
      "BOOLEAN_GEOMETRY_FILL",
      reason,
      source,
      "/style/fills",
      "info",
    );
  }
}
/** Figma cannot combine a FRAME operand directly. Sketch combined shapes are
 * held in source-bounds frames, so use an editable copy of their native renderer
 * and retain the complete original source subtree for relationships/reimport. */
async function nativeOperand(
  ctx: ImportContext,
  owner: Sketch,
  parent: FrameNode,
  operand: Operand,
): Promise<SceneNode> {
  const node = operand.node;
  if (!["FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) return node;
  const renderer =
    operand.source?._class === "shapeGroup" && "children" in node
      ? node.children.find(
          (c) =>
            c.getPluginData("sketch2figma:wrapper") === "boolean" &&
            !c.getPluginData("sketch2figma:obsolete"),
        )
      : undefined;
  const transform = relativeTo(renderer ?? node, parent);
  let copy = (renderer ?? node).clone();
  ctx.journal.track(copy);
  parent.appendChild(copy);
  copy.relativeTransform = transform;
  const clearIds = (n: SceneNode) => {
    n.setPluginData("sketch2figma:sourceId", "");
    if ("children" in n) for (const child of n.children) clearIds(child);
  };
  clearIds(copy);
  if (!renderer) {
    // Frame/Symbol geometry cannot be passed directly to Figma's boolean APIs.
    // Resolve only the disposable copy; original components and bindings survive.
    copy = ctx.api.flatten([copy], parent);
    ctx.journal.track(copy);
    clearIds(copy);
  }
  copy.setPluginData(
    "sketch2figma:operandSource",
    operand.source
      ? sourceId(operand.source)
      : node.getPluginData("sketch2figma:operandSource"),
  );
  owned(ctx, operand.source ?? owner, copy, "boolean-operand");
  const originals = ctx.api.createFrame();
  ctx.journal.track(originals);
  parent.appendChild(originals);
  owned(ctx, owner, originals, "boolean-sources");
  originals.fills = [];
  originals.clipsContent = false;
  originals.visible = false;
  originals.resize(Math.max(0.01, parent.width), Math.max(0.01, parent.height));
  originals.relativeTransform = identity;
  await ctx.journal.before(node);
  const position = relativeTo(node, parent);
  originals.appendChild(node);
  node.relativeTransform = position;
  if (operand.source) {
    const reason =
      "Frame or nested combined shape uses an editable geometry copy as the boolean operand. The complete original source subtree is retained in a hidden container; editing that retained subtree does not update the operative copy live.";
    ctx.ledger(operand.source).mark("/_class", "Editable Equivalent", reason);
    ctx.finding(
      "BOOLEAN_OPERAND_COPY",
      reason,
      operand.source,
      "/layers",
      "info",
    );
  }
  return copy;
}
async function combine(
  ctx: ImportContext,
  s: Sketch,
  parent: FrameNode,
  left: SceneNode,
  right: SceneNode,
  op: Exclude<ReturnType<typeof shapeOperation>, "NONE">,
): Promise<BooleanOperationNode> {
  await operativeGeometry(ctx, left);
  await operativeGeometry(ctx, right);
  // Children are ordered bottom to top; subtraction cuts right from left.
  // Group-like APIs may sort by existing stacking rather than argument order.
  parent.appendChild(left);
  parent.appendChild(right);
  const result =
    op === "SUBTRACT"
      ? ctx.api.subtract([left, right], parent)
      : op === "INTERSECT"
        ? ctx.api.intersect([left, right], parent)
        : op === "EXCLUDE"
          ? ctx.api.exclude([left, right], parent)
          : ctx.api.union([left, right], parent);
  ctx.journal.track(result);
  owned(ctx, s, result, "boolean-step");
  if (result.booleanOperation !== op)
    throw new Error(
      `Figma boolean readback was ${result.booleanOperation}, expected ${op}`,
    );
  return result;
}
/** Source array order is authoritative. Never zip filtered/reordered native
 * children with source layers, and never default None/unknown values to Union. */
export async function applyBooleanShape(
  ctx: ImportContext,
  s: Sketch,
  parent: FrameNode,
): Promise<void> {
  const layers: Sketch[] = s.layers ?? [],
    rule = windingRule(s.style?.windingRule);
  for (const child of layers) shapeOperation(child.booleanOperation);
  const operands = layers.map((source) => ({
    source,
    node: ctx.nodes.get(sourceId(source)),
  }));
  if (operands.some((o) => !o.node))
    throw new Error(`${s.name}: boolean operand missing from import`);
  const active = operands.filter(
    (o) => o.source.isVisible !== false,
  ) as (Operand & { source: Sketch })[];
  if (active[0])
    ctx
      .ledger(active[0].source)
      .mark(
        "/booleanOperation",
        "Native",
        "The first operand supplies base geometry; its operator has no preceding operand.",
      );
  let result: SceneNode | undefined, pendingBase: Sketch | undefined;
  // Consecutive None contours are a single fill region, including the initial
  // contour. Later explicit operators evaluate the preceding result in order.
  let pending: Operand[] = [];
  const flush = async () => {
    if (!pending.length) return;
    pendingBase =
      pending.length === 1 && !result ? pending[0].source : undefined;
    result =
      pending.length === 1 && !result
        ? pending[0].node
        : await compound(ctx, s, parent, pending, rule);
    pending = [];
  };
  for (const o of active) {
    if (ctx.cancelled) throw new Error("IMPORT_CANCELLED");
    if (!result && !pending.length) {
      pending.push(o);
      continue;
    }
    const op = shapeOperation(o.source.booleanOperation);
    if (op === "NONE") {
      if (pending.length) pending.push(o);
      else if (result && rule === "EVENODD") {
        const contour = await compound(ctx, s, parent, [o], rule);
        result = await combine(ctx, s, parent, result, contour, "EXCLUDE");
      } else if (result) pending = [{ node: result }, o];
    } else {
      await flush();
      if (result) {
        const base = await nativeOperand(ctx, s, parent, {
            node: result,
            source: pendingBase,
          }),
          right = await nativeOperand(ctx, s, parent, o);
        await operativeGeometry(ctx, base, pendingBase);
        await operativeGeometry(ctx, right, o.source);
        result = await combine(ctx, s, parent, base, right, op);
        pendingBase = undefined;
      }
      ctx.ledger(o.source).mark("/booleanOperation");
    }
  }
  await flush();
  // The first operator has no prior operand. A lone shape retains the parent
  // fill rule even when its serialized operator is Union/Subtract/etc.
  if (active.length === 1)
    result = await compound(ctx, s, parent, [active[0]], rule);
  if (result) {
    const width = Math.max(0.01, finite(s.frame?.width, 1)),
      height = Math.max(0.01, finite(s.frame?.height, 1));
    const t = relativeTo(result, parent);
    await applyAppearance(ctx, s, result, {
      width,
      height,
      transform: [
        [
          (t[0][0] * result.width) / width,
          (t[0][1] * result.height) / width,
          t[0][2] / width,
        ],
        [
          (t[1][0] * result.width) / height,
          (t[1][1] * result.height) / height,
          t[1][2] / height,
        ],
      ],
    });
    owned(ctx, s, result, "boolean");
    if (result.type === "BOOLEAN_OPERATION")
      ctx
        .ledger(s)
        .mark(
          "/_class",
          "Editable Equivalent",
          "Live native boolean operations inside the source-bounds frame; original operands retained.",
        );
  } else
    ctx
      .ledger(s)
      .mark(
        "/_class",
        "Editable Equivalent",
        "Empty or hidden source shape operands retained without adding visible geometry.",
      );
  parent.fills = [];
  parent.strokes = [];
  parent.effects = [];
  ctx.ledger(s).mark("/style/windingRule");
  // Old wrappers can be removed only after commit and only after all source
  // operands have moved out. Exclude them from reimport fingerprints meanwhile.
  const keep = new Set(
    parent.children
      .filter(
        (n) =>
          n.id === result?.id ||
          (n.getPluginData(ownerKey) === sourceId(s) &&
            !n.getPluginData("sketch2figma:obsolete") &&
            "children" in n &&
            n.findAll((c) => !!c.getPluginData("sketch2figma:sourceId"))
              .length),
      )
      .map((n) => n.id),
  );
  await retire(ctx, s, parent, keep);
}

/** Structural readback, independently of setter success. Pixel fidelity remains
 * a separate render comparison. Detect the original Union-for-None regression. */
export function validateBooleanShape(
  ctx: ImportContext,
  s: Sketch,
  parent: SceneNode,
): void {
  if (!("children" in parent)) return;
  const active: Sketch[] = (s.layers ?? []).filter(
    (c: Sketch) => c.isVisible !== false,
  );
  const result = parent.children.find(
    (c) =>
      c.getPluginData("sketch2figma:wrapper") === "boolean" &&
      !c.getPluginData("sketch2figma:obsolete"),
  );
  const pure =
    (active
      .slice(1)
      .every((c) => shapeOperation(c.booleanOperation) === "NONE") &&
      active.length > 1) ||
    active.length === 1;
  let passed: boolean | null = !!result || !active.length,
    expected: unknown,
    actual: unknown;
  if (pure) {
    const rule = windingRule(s.style?.windingRule);
    expected = {
      representation: "compound",
      windingRule: rule,
      sourceOperands: active.length,
    };
    actual =
      result?.type === "VECTOR"
        ? {
            representation: "compound",
            windingRule: result.vectorNetwork.regions?.[0]?.windingRule,
            contours: result.vectorNetwork.regions?.reduce(
              (n, r) => n + r.loops.length,
              0,
            ),
          }
        : { representation: result?.type };
    if (result?.type !== "VECTOR") passed = false;
    else {
      try {
        const network = joinContours(
          active.map((c) => sourceContours(c, rule)),
          rule,
        );
        const native = mapNetwork(
          result.vectorNetwork,
          relativeTo(result, parent),
        );
        expected = {
          ...(expected as object),
          contours: network.regions?.reduce((n, r) => n + r.loops.length, 0),
        };
        passed = contoursEquivalent(network, native);
      } catch (error) {
        passed = null;
        actual = { ...(actual as object), reason: String(error) };
      }
    }
  } else if (result) {
    const operations: string[] = [],
      leaves: string[] = [];
    const visit = (n: SceneNode) => {
      const id =
        n.getPluginData("sketch2figma:operandSource") ||
        n.getPluginData("sketch2figma:sourceId");
      if (id) {
        leaves.push(id);
        return;
      }
      if (n.type === "BOOLEAN_OPERATION") {
        for (const c of n.children) visit(c);
        operations.push(n.booleanOperation);
      } else if (n.type === "VECTOR") {
        const ids = JSON.parse(
          n.getPluginData("sketch2figma:contourSources") || "[]",
        );
        leaves.push(...ids);
      }
    };
    visit(result);
    const explicit = active
      .slice(1)
      .map((c) => shapeOperation(c.booleanOperation))
      .filter((op) => op !== "NONE");
    const mixedNone = active
      .slice(1)
      .some((c) => shapeOperation(c.booleanOperation) === "NONE");
    expected = { operations: explicit, operands: active.map(sourceId) };
    actual = { operations, operands: leaves };
    passed = mixedNone
      ? null
      : JSON.stringify(expected) === JSON.stringify(actual);
  }
  ctx.report.validations.push({
    kind: "boolean-geometry",
    sourceId: sourceId(s),
    expected,
    actual,
    passed,
    message: `${s.name}: ${passed === null ? "compound geometry could not be compared or mixed operators require native render comparison" : passed ? "compound contours or boolean sequence match native readback" : "compound contours or boolean sequence differ from source"}.`,
  });
  if (passed === false) {
    ctx
      .ledger(s)
      .mark(
        "/_class",
        "Partial",
        "Boolean geometry readback differs from source.",
      );
    ctx.finding(
      "BOOLEAN_DIFFERENCE",
      "Compound contours or native boolean sequence differ from source.",
      s,
      "/layers",
      "error",
    );
  }
}
type Curve = number[];
/** Loop order defines traversal, not a segment's stored start/end direction.
 * Compare directed cubic geometry with the same pixel tolerance as the rest of
 * the geometry report, allowing cyclic starts and reordered contours. */
function contourCurves(
  network: VectorNetwork,
  loop: readonly number[],
): Curve[] {
  return loop.map((index, i) => {
    const e = network.segments[index],
      next = network.segments[loop[(i + 1) % loop.length]];
    if (!e || !next) throw new Error("Invalid compound segment indices");
    const forward =
      loop.length === 1 || e.end === next.start || e.end === next.end;
    const a = network.vertices[forward ? e.start : e.end],
      b = network.vertices[forward ? e.end : e.start],
      from = forward ? e.tangentStart : e.tangentEnd,
      to = forward ? e.tangentEnd : e.tangentStart;
    if (!a || !b) throw new Error("Invalid compound vertex indices");
    return [
      a.x,
      a.y,
      a.x + (from?.x ?? 0),
      a.y + (from?.y ?? 0),
      b.x + (to?.x ?? 0),
      b.y + (to?.y ?? 0),
      b.x,
      b.y,
      a.cornerRadius ?? 0,
      b.cornerRadius ?? 0,
    ];
  });
}
function reverseContour(loop: Curve[]): Curve[] {
  return [...loop]
    .reverse()
    .map((c) => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1], c[9], c[8]]);
}
function sameContour(a: Curve[], b: Curve[]): boolean {
  if (a.length !== b.length) return false;
  return b.some((_, offset) =>
    a.every((curve, i) =>
      curve.every((value, j) => {
        const actual = b[(offset + i) % b.length][j];
        return (
          Number.isFinite(value) &&
          Number.isFinite(actual) &&
          Math.abs(value - actual) < GEOMETRY_TOLERANCE.pixels
        );
      }),
    ),
  );
}
function sameLoops(
  expected: Curve[][],
  actual: Curve[][],
  allowReverse: boolean,
): boolean {
  if (expected.length !== actual.length) return false;
  const remaining = [...actual];
  return expected.every((loop) => {
    const i = remaining.findIndex(
      (other) =>
        sameContour(loop, other) ||
        (allowReverse && sameContour(loop, reverseContour(other))),
    );
    if (i < 0) return false;
    remaining.splice(i, 1);
    return true;
  });
}
function contoursEquivalent(
  expected: VectorNetwork,
  actual: VectorNetwork,
): boolean {
  const a = expected.regions ?? [],
    b = actual.regions ?? [];
  if (a.length !== b.length) return false;
  return a.every((region, i) => {
    const other = b[i];
    if (region.windingRule !== other.windingRule) return false;
    const sourceLoops = region.loops.map((loop) =>
        contourCurves(expected, loop),
      ),
      nativeLoops = other.loops.map((loop) => contourCurves(actual, loop));
    // Evenodd is independent of direction. Nonzero allows a global reversal,
    // but reversing just one contour can change a hole into a filled area.
    return (
      sameLoops(sourceLoops, nativeLoops, region.windingRule === "EVENODD") ||
      (region.windingRule === "NONZERO" &&
        sameLoops(sourceLoops, nativeLoops.map(reverseContour), false))
    );
  });
}
