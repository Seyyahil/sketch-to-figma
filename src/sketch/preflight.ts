import { masters, dependencyOrder } from "../core/dependencies";
import {
  sourceId,
  walkLayers,
  type Preflight,
  type Sketch,
  type SketchFile,
} from "../core/types";
export function preflight(
  file: SketchFile,
  libraries: SketchFile[] = [],
): Preflight {
  const available = masters(file);
  for (const lib of libraries)
    for (const [id, s] of masters(lib))
      if (!available.has(id)) available.set(id, s);
  const all = walkLayers(file.pages),
    fonts = new Set<string>(),
    refs = new Set<string>();
  function scan(s: unknown): void {
    if (!s || typeof s !== "object") return;
    const o = s as Sketch;
    if (o._class === "fontDescriptor" && o.attributes?.name)
      fonts.add(o.attributes.name);
    if (o._ref_class === "MSImageData" && o._ref && !o.data) refs.add(o._ref);
    for (const v of Object.values(o)) scan(v);
  }
  scan(file.document);
  scan(file.pages);
  const assets = new Set(file.assets.map((a) => a.path));
  const dep = dependencyOrder(available);
  const preview = (n: Sketch): any => ({
    id: sourceId(n),
    name: n.name ?? n._class,
    type: n._class,
    children: (n.layers ?? []).map(preview),
  });
  return {
    file: file.name,
    documentId: file.documentId,
    version: file.version,
    pages: file.pages.map((p) => ({
      id: sourceId(p),
      name: p.name,
      layers: (p.layers ?? []).map(preview),
      count: walkLayers(p.layers ?? []).length,
    })),
    symbols: [...available].map(([id, s]) => ({ id, name: s.name })),
    fonts: [...fonts],
    images: file.assets.filter(
      (a) =>
        a.path.startsWith("images/") && !/\.tile-\d+-\d+\.png$/.test(a.path),
    ).length,
    missingImages: [...refs].filter(
      (r) =>
        !assets.has(r) && !file.assets.some((a) => a.path.startsWith(`${r}.`)),
    ),
    missingSymbols: [
      ...new Set(
        all
          .filter(
            (n) =>
              n._class === "symbolInstance" &&
              !available.has(String(n.symbolID)),
          )
          .map((n) => String(n.symbolID)),
      ),
    ],
    styleCount:
      (file.document.layerStyles?.objects?.length ?? 0) +
      (file.document.layerTextStyles?.objects?.length ?? 0),
    colorCount: file.document.sharedSwatches?.objects?.length ?? 0,
    warnings: [
      ...file.warnings,
      ...dep.cycles.map((c) => ({
        code: "SYMBOL_CYCLE",
        severity: "error" as const,
        message: c.join(" → "),
      })),
    ],
  };
}
