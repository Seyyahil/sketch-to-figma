import { sourceId, walkLayers, type Sketch, type SketchFile } from "./types";
export function masters(file: SketchFile): Map<string, Sketch> {
  const all = walkLayers(file.pages).filter((n) => n._class === "symbolMaster");
  for (const f of file.document.foreignSymbols ?? [])
    if (f.symbolMaster) all.push(f.symbolMaster);
  return new Map(all.map((s) => [String(s.symbolID), s]));
}
export function dependencyOrder(items: Map<string, Sketch>): {
  ordered: Sketch[];
  cycles: string[][];
  missing: string[];
} {
  const ordered: Sketch[] = [],
    cycles: string[][] = [],
    missing = new Set<string>(),
    state = new Map<string, number>();
  function visit(id: string, chain: string[]) {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      cycles.push([...chain, id]);
      return;
    }
    const s = items.get(id);
    if (!s) {
      missing.add(id);
      return;
    }
    state.set(id, 1);
    for (const n of walkLayers(s.layers ?? []))
      if (n._class === "symbolInstance")
        visit(String(n.symbolID), [...chain, id]);
    state.set(id, 2);
    ordered.push(s);
  }
  for (const id of items.keys()) visit(id, []);
  return { ordered, cycles, missing: [...missing] };
}
/** Select matching nodes, all descendants, and ancestors needed to preserve hierarchy. */
export function selection(pages: Sketch[], ids: string[]): Set<string> {
  const out = new Set<string>();
  const selected = new Set(ids);
  const all = ids.length === 0;
  function visit(n: Sketch, inherited: boolean): boolean {
    const yes = all || inherited || selected.has(sourceId(n));
    let any = yes;
    for (const c of n.layers ?? []) any = visit(c, yes) || any;
    if (any) out.add(sourceId(n));
    return any;
  }
  for (const p of pages) visit(p, false);
  return out;
}
export function requiredSymbols(
  pages: Sketch[],
  scope: Set<string>,
  available: Map<string, Sketch>,
): Set<string> {
  const result = new Set<string>();
  function add(id: string) {
    if (result.has(id)) return;
    result.add(id);
    const s = available.get(id);
    if (s)
      for (const n of walkLayers(s.layers ?? []))
        if (n._class === "symbolInstance") {add(String(n.symbolID));for(const o of n.overrideValues??[])if(String(o.overrideName).endsWith("_symbolID")&&o.value)add(String(o.value));}
  }
  for (const n of walkLayers(pages))
    if (scope.has(sourceId(n)) && n._class === "symbolInstance")
      {add(String(n.symbolID));for(const o of n.overrideValues??[])if(String(o.overrideName).endsWith("_symbolID")&&o.value)add(String(o.value));}
  return result;
}
