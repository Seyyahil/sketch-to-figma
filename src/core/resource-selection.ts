import { masters, requiredSymbols, selection } from "./dependencies";
import {
  sourceId,
  walkLayers,
  type ImportOptions,
  type ResourceKind,
  type Sketch,
  type SketchFile,
} from "./types";

export const includeUnused = (
  options: ImportOptions,
  kind: ResourceKind,
): boolean => options.resourceTypes?.[kind] ?? options.resources;
export function sourceStyles(
  file: SketchFile,
  kind: "layerStyles" | "textStyles",
): Sketch[] {
  const foreign =
    kind === "layerStyles" ? "foreignLayerStyles" : "foreignTextStyles";
  const local = kind === "layerStyles" ? "layerStyles" : "layerTextStyles";
  return [
    ...(file.document[local]?.objects ?? []),
    ...(file.document[foreign] ?? [])
      .map((s: Sketch) => s.localSharedStyle)
      .filter(Boolean),
  ];
}
export interface ResourceSelection {
  scope: Set<string>;
  symbols: Set<string>;
  layers: Sketch[];
  styles: Set<string>;
  colors: Set<string>;
  tokenNames: Set<string>;
}
/** Switches can omit unused definitions; live source references always win. */
export function resourceSelection(
  file: SketchFile,
  options: ImportOptions,
): ResourceSelection {
  const scope = (options as ImportOptions & { resourcesOnly?: boolean })
    .resourcesOnly
    ? new Set<string>()
    : selection(file.pages, options.selectedIds);
  // A selected compound contour requires every operand in its shape group.
  // Include their resources as well as geometry in the dependency closure.
  for (const group of walkLayers(file.pages))
    if (group._class === "shapeGroup" && scope.has(sourceId(group)))
      for (const child of walkLayers(group.layers ?? []))
        scope.add(sourceId(child));
  const available = masters(file),
    ordinary = new Set(scope);
  for (const master of available.values())
    for (const layer of walkLayers([master])) ordinary.delete(sourceId(layer));
  const symbols = requiredSymbols(file.pages, ordinary, available);
  const selected = new Set(options.selectedIds);
  for (const [id, master] of available)
    if (
      includeUnused(options, "components") ||
      selected.has(id) ||
      selected.has(sourceId(master))
    ) {
      symbols.add(id);
      for (const child of requiredSymbols(
        [master],
        new Set(walkLayers([master]).map(sourceId)),
        available,
      ))
        symbols.add(child);
    }
  if (options.resourceTypes?.components === false)
    for (const [id, master] of available)
      if (!symbols.has(id))
        for (const layer of walkLayers([master])) scope.delete(sourceId(layer));
  const byId = new Map(
    walkLayers(file.pages)
      .filter((n) => scope.has(sourceId(n)))
      .map((n) => [sourceId(n), n]),
  );
  for (const id of symbols) {
    const master = available.get(id);
    if (master)
      for (const layer of walkLayers([master]))
        byId.set(sourceId(layer), layer);
  }
  const styles = new Set<string>(),
    colors = new Set<string>();
  function references(value: unknown) {
    if (!value || typeof value !== "object") return;
    const object = value as Sketch;
    if (typeof object.sharedStyleID === "string")
      styles.add(object.sharedStyleID);
    if (typeof object.swatchID === "string") colors.add(object.swatchID);
    if (
      /_(textStyle|layerStyle)$/.test(String(object.overrideName)) &&
      typeof object.value === "string"
    )
      styles.add(object.value);
    for (const [key, child] of Object.entries(object))
      if (key !== "layers" && key !== "userInfo") references(child);
  }
  for (const layer of byId.values()) references(layer);
  const definitions = [
    ...sourceStyles(file, "layerStyles"),
    ...sourceStyles(file, "textStyles"),
  ];
  for (const kind of ["layerStyles", "textStyles"] as const)
    if (includeUnused(options, kind))
      for (const style of sourceStyles(file, kind)) styles.add(sourceId(style));
  // Styles can refer to colors and other style definitions. Resolve the closure.
  const scanned = new Set<string>();
  for (const id of styles) {
    if (scanned.has(id)) continue;
    scanned.add(id);
    const definition = definitions.find((s) => sourceId(s) === id);
    if (definition) references(definition.value);
  }
  const tokenNames = new Set<string>(),
    tokens = options.tokens;
  const requireToken = (name: string) => {
    if (tokenNames.has(name)) return;
    tokenNames.add(name);
    const token = tokens?.tokens.find((t) => t.name === name);
    for (const value of Object.values(token?.values ?? {}))
      if (typeof value === "string" && /^\{.+\}$/.test(value))
        requireToken(value.slice(1, -1));
  };
  if (tokens) {
    if (includeUnused(options, "tokens"))
      for (const token of tokens.tokens) requireToken(token.name);
    for (const binding of tokens.bindings ?? [])
      if (byId.has(binding.sourceId)) requireToken(binding.token);
  }
  return {
    scope,
    symbols,
    layers: [...byId.values()],
    styles,
    colors,
    tokenNames,
  };
}
export function importFontNames(
  file: SketchFile,
  options: ImportOptions,
): string[] {
  const plan = resourceSelection(file, options),
    fonts = new Set<string>();
  const scan = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const o = value as Sketch;
    if (o._class === "fontDescriptor" && typeof o.attributes?.name === "string")
      fonts.add(o.attributes.name);
    if (o.MSAttributedStringFontAttribute?.attributes?.name)
      fonts.add(o.MSAttributedStringFontAttribute.attributes.name);
    for (const [key, child] of Object.entries(o))
      if (key !== "layers" && key !== "userInfo") scan(child);
  };
  for (const layer of plan.layers) scan(layer);
  for (const style of [
    ...sourceStyles(file, "layerStyles"),
    ...sourceStyles(file, "textStyles"),
  ])
    if (plan.styles.has(sourceId(style))) scan(style.value);
  return [...fonts];
}
