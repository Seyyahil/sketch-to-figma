import { finite } from "../core/math";
import { sourceId, walkLayers, type Sketch } from "../core/types";
import type { ImportContext } from "./context";
function pageOf(node: BaseNode): PageNode | undefined {
  let p: BaseNode | null = node;
  while (p && p.type !== "PAGE") p = p.parent;
  return p?.type === "PAGE" ? p : undefined;
}
function transition(ctx: ImportContext, s: Sketch): Transition | null {
  const flow = s.flow;
  if (!flow?.animationType) return null;
  const direction = (["LEFT", "LEFT", "RIGHT", "BOTTOM", "TOP"] as const)[
    flow.animationType
  ];
  if (!direction) {
    ctx.finding(
      "PROTOTYPE_TRANSITION",
      `Unsupported animation type ${flow.animationType}.`,
      s,
      "/flow/animationType",
    );
    return null;
  }
  ctx
    .ledger(s)
    .mark(
      "/flow/animationType",
      "Partial",
      "Native directional transition; missing source duration/easing uses 0.3s Ease In And Out.",
    );
  return {
    type: "SLIDE_IN",
    direction,
    matchLayers: false,
    duration: finite(flow.duration, 0.3),
    easing: { type: "EASE_IN_AND_OUT" },
  };
}
export async function applyPrototypes(
  ctx: ImportContext,
  mutable: Set<string>,
): Promise<void> {
  const all = walkLayers(ctx.file.pages),
    cross = all.filter((s) => {
      const n = ctx.nodes.get(sourceId(s)),
        d = ctx.nodes.get(String(s.flow?.destinationArtboardID));
      return n && d && pageOf(n)?.id !== pageOf(d)?.id;
    });
  let generated: Map<string, SceneNode> | undefined;
  if (cross.length && ctx.options.generatePrototypePage) {
    const page = ctx.api.createPage();
    ctx.journal.track(page);
    page.name = `${ctx.file.name} / Prototype arrangement`;
    generated = new Map();
    let x = 0;
    for (const source of all.filter((s) => s._class === "artboard")) {
      const node = ctx.nodes.get(sourceId(source));
      if (!node) continue;
      const clone = node.clone();
      ctx.journal.track(clone);
      page.appendChild(clone);
      clone.x = x;
      clone.y = 0;
      x += clone.width + 120;
      const index = (n: SceneNode) => {
        const id = n.getPluginData("sketch2figma:sourceId");
        if (id) generated!.set(id, n);
        if ("children" in n) for (const c of n.children) index(c);
      };
      index(clone);
    }
    ctx.finding(
      "PROTOTYPE_ARRANGEMENT",
      "Generated a separate single-page prototype arrangement for cross-page links; source page hierarchy is retained.",
      undefined,
      undefined,
      "info",
    );
  }
  for (const s of all) {
    const id = sourceId(s);
    if (!s.flow) continue;
    const targets = [
      ...(mutable.has(id) ? [ctx.nodes.get(id)] : []),
      generated?.get(id),
    ].filter(Boolean) as SceneNode[];
    for (const node of targets) {
      if (!("setReactionsAsync" in node)) continue;
      const dest = String(s.flow.destinationArtboardID);
      let action: Action | undefined;
      if (dest === "back") action = { type: "BACK" };
      else if (/^https?:\/\//.test(dest)) action = { type: "URL", url: dest };
      else {
        const destination = (
          generated && pageOf(node)?.id === pageOf(generated.get(id)!)?.id
            ? generated
            : ctx.nodes
        )?.get(dest);
        if (!destination) {
          ctx.finding(
            "PROTOTYPE_DESTINATION",
            `Missing navigation destination ${dest}.`,
            s,
            "/flow/destinationArtboardID",
          );
          continue;
        }
        if (pageOf(node)?.id !== pageOf(destination)?.id) {
          ctx.finding(
            "CROSS_PAGE_PROTOTYPE",
            "Cross-page navigation requires the optional generated prototype arrangement.",
            s,
            "/flow/destinationArtboardID",
          );
          continue;
        }
        action = {
          type: "NODE",
          destinationId: destination.id,
          navigation: "NAVIGATE",
          transition: transition(ctx, s),
          resetScrollPosition: !s.flow.maintainScrollPosition,
        };
      }
      await ctx.attempt(
        s,
        "/flow",
        async () => {
          await node.setReactionsAsync([
            { trigger: { type: "ON_CLICK" }, actions: [action!] },
          ]);
        },
        ["_class", "destinationArtboardID", "maintainScrollPosition"],
      );
      if (!s.flow.animationType) ctx.ledger(s).mark("/flow/animationType");
    }
  }
  for (const p of ctx.file.pages) {
    const pid = ctx.index.pages[sourceId(p)],
      page = pid ? await ctx.api.getNodeByIdAsync(pid) : null;
    if (!page || page.type !== "PAGE") continue;
    const starts = (p.layers ?? [])
      .filter((s: Sketch) => s.isFlowHome && ctx.nodes.has(sourceId(s)))
      .map((s: Sketch) => {
        ctx.ledger(s).mark("/isFlowHome");
        return { nodeId: ctx.nodes.get(sourceId(s))!.id, name: s.name };
      });
    if (starts.length) {
      (ctx.journal as any).beforePage?.(page);
      page.flowStartingPoints = [
        ...page.flowStartingPoints.filter(
          (f) => !starts.some((s: { nodeId: string }) => s.nodeId === f.nodeId),
        ),
        ...starts,
      ];
    }
  }
}
