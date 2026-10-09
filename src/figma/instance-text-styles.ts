import { overrideTarget } from "./symbols";
import { readData } from "./storage";
import type { Sketch } from "../core/types";

/** Outer Symbol overrides take precedence over defaults in nested Symbols. */
export function instanceTextSources(
  instance: InstanceNode,
  source: Sketch,
): { node: TextNode; source: Sketch }[] {
  const overrides = new Map<string, string>();
  const collect = (node: SceneNode) => {
    if ("children" in node) for (const child of node.children) collect(child);
    if (node.type !== "INSTANCE") return;
    const original =
      node === instance
        ? source
        : readData<Sketch | null>(node, "source", null);
    for (const override of original?.overrideValues ?? []) {
      const match = String(override.overrideName).match(/^(.*)_textStyle$/);
      if (!match) continue;
      const target = overrideTarget(node, match[1].split("/"));
      if (target?.type === "TEXT")
        overrides.set(target.id, String(override.value));
    }
  };
  collect(instance);
  const result: { node: TextNode; source: Sketch }[] = [];
  const visit = (node: SceneNode) => {
    if (node.type === "TEXT") {
      const original = readData<Sketch | null>(node, "source", null);
      if (original || overrides.has(node.id))
        result.push({
          node,
          source: {
            ...(original ?? {
              _class: "text",
              do_objectID: node.id,
              name: node.name,
            }),
            sharedStyleID: overrides.get(node.id) ?? original?.sharedStyleID,
          },
        });
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };
  visit(instance);
  return result;
}
