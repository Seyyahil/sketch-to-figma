import { sameFont, samePaints, sameValue } from "./property-equality";
import { fingerprint } from "../core/math";
import type { ImportIndex, Sketch, StoredMapping } from "../core/types";
const CHUNK = 24000,
  NS = "sketch2figma";
export function writeData(
  node: PluginDataMixin,
  key: string,
  value: unknown,
): void {
  const data = JSON.stringify(value);
  const prior = Number(node.getPluginData(`${NS}:${key}:count`) || 0),
    count = Math.ceil(data.length / CHUNK);
  for (let i = 0; i < count; i++)
    node.setPluginData(
      `${NS}:${key}:${i}`,
      data.slice(i * CHUNK, (i + 1) * CHUNK),
    );
  for (let i = count; i < prior; i++)
    node.setPluginData(`${NS}:${key}:${i}`, "");
  node.setPluginData(`${NS}:${key}:count`, String(count));
}
export function readData<T>(
  node: PluginDataMixin,
  key: string,
  fallback: T,
): T {
  const count = Number(node.getPluginData(`${NS}:${key}:count`) || 0);
  if (!count) return fallback;
  if (!Number.isInteger(count) || count > 50000)
    throw new Error(`Invalid metadata chunk count: ${key}`);
  let text = "";
  for (let i = 0; i < count; i++)
    text += node.getPluginData(`${NS}:${key}:${i}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Corrupted import metadata: ${key}`);
  }
}
export function emptyIndex(documentId: string): ImportIndex {
  return {
    version: 1,
    documentId,
    nodes: {},
    pages: {},
    resources: {},
    assets: {},
    sourceDigest: "",
  };
}
export function readIndex(api: PluginAPI, id: string): ImportIndex {
  return readData(api.root, `index:${id}`, emptyIndex(id));
}
export function writeIndex(api: PluginAPI, index: ImportIndex): void {
  writeData(api.root, `index:${index.documentId}`, index);
}
export interface NodeSnapshot {
  props: Sketch;
  parentId: string | null;
  index: number;
  plugin: Record<string, string>;
  children?: NodeSnapshot[];
  childOrder?: string[];
}
/** Use only within one immutable read pass; clear before mutating any scene node. */
export class FingerprintPass {
  readonly snapshots = new Map<string, NodeSnapshot>();
  readonly links = new Map<string, Record<string, string | null>>();
  clear() {
    this.snapshots.clear();
    this.links.clear();
  }
}
const SCENE_FIELDS = [
  "name",
  "visible",
  "locked",
  "opacity",
  "blendMode",
  "relativeTransform",
  "width",
  "height",
  "constraints",
  "fills",
  "strokes",
  "strokeWeight",
  "strokeAlign",
  "strokeCap",
  "strokeJoin",
  "strokeMiterLimit",
  "dashPattern",
  "effects",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomRightRadius",
  "bottomLeftRadius",
  "cornerSmoothing",
  "exportSettings",
  "isMask",
  "maskType",
  "clipsContent",
  "layoutMode",
  "layoutWrap",
  "itemSpacing",
  "counterAxisSpacing",
  "counterAxisAlignContent",
  "itemReverseZIndex",
  "strokesIncludedInLayout",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "layoutPositioning",
  "layoutGrow",
  "layoutAlign",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "overflowDirection",
  "numberOfFixedChildren",
  "vectorPaths",
  "vectorNetwork",
  "booleanOperation",
  "textAutoResize",
  "textAlignHorizontal",
  "textAlignVertical",
  "textTruncation",
  "paragraphSpacing",
  "paragraphIndent",
  "listSpacing",
  "characters",
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
  "fillStyleId",
  "strokeStyleId",
  "effectStyleId",
  "textStyleId",
  "reactions",
  "layoutGrids",
  "guides",
];
export function capture(
  node: SceneNode,
  recursive = false,
  includePlugin = true,
  skipObsolete = false,
  cache?: Map<string, NodeSnapshot>,
): NodeSnapshot {
  const prior = cache?.get(node.id);
  if (prior) return prior;
  const props: Sketch = { type: node.type };
  props.variableBindings = Object.fromEntries(
    Object.entries(node.boundVariables ?? {}).filter(
      ([, v]) => v && !Array.isArray(v) && v.type === "VARIABLE_ALIAS",
    ),
  );
  for (const key of SCENE_FIELDS) {
    if (key in node) {
      try {
        const value = (node as unknown as Sketch)[key];
        if (typeof value !== "symbol" && value !== undefined)
          props[key] = JSON.parse(JSON.stringify(value));
      } catch {
        /* A type-specific getter may be unavailable; it is not part of the mutation surface. */
      }
    }
  }
  if (node.type === "TEXT")
    props.segments = node.getStyledTextSegments([
      "fontName",
      "fontSize",
      "fills",
      "letterSpacing",
      "lineHeight",
      "textCase",
      "textDecoration",
      "textStyleId",
      "fillStyleId",
      "boundVariables",
      "listOptions",
      "paragraphIndent",
      "paragraphSpacing",
      "listSpacing",
    ]);
  const plugin = includePlugin
    ? Object.fromEntries(
        node.getPluginDataKeys().map((k) => [k, node.getPluginData(k)]),
      )
    : {};
  const result: NodeSnapshot = {
    props,
    parentId: node.parent?.id ?? null,
    index:
      node.parent && "children" in node.parent
        ? node.parent.children.findIndex((child) => child.id === node.id)
        : 0,
    plugin,
    ...("children" in node && node.type !== "INSTANCE"
      ? { childOrder: node.children.map((child) => child.id) }
      : {}),
    ...(recursive && "children" in node
      ? {
          children: node.children
            .filter(
              (c) => !skipObsolete || !c.getPluginData("sketch2figma:obsolete"),
            )
            .map((c) => capture(c, true, includePlugin, skipObsolete, cache)),
        }
      : {}),
  };
  cache?.set(node.id, result);
  return result;
}
export async function targetFingerprint(
  node: SceneNode,
  version: 1 | 2 = 2,
  pass?: FingerprintPass,
): Promise<string> {
  const snap = capture(node, true, false, true, pass?.snapshots);
  const clean = (s: NodeSnapshot): unknown => ({
    props:
      version === 1
        ? Object.fromEntries(
            Object.entries(s.props).filter(
              ([key]) => !["vectorNetwork", "booleanOperation"].includes(key),
            ),
          )
        : s.props,
    children: s.children?.map(clean),
  });
  const visit = async (
    n: SceneNode,
  ): Promise<Record<string, string | null>> => {
    const prior = pass?.links.get(n.id);
    if (prior) return prior;
    const links: Record<string, string | null> = {};
    if (n.type === "INSTANCE")
      links[n.id] = (await n.getMainComponentAsync())?.id ?? null;
    if ("children" in n)
      for (const child of n.children) Object.assign(links, await visit(child));
    pass?.links.set(n.id, links);
    return links;
  };
  const links = await visit(node);
  return fingerprint({
    componentLinks: links,
    parentId: snap.parentId,
    index: snap.index,
    content: clean(snap),
    ownedAppearance:
      node.parent?.type === "FRAME" &&
      node.parent.getPluginData("sketch2figma:fadeFor") ===
        node.getPluginData("sketch2figma:sourceId")
        ? clean(capture(node.parent, true, false))
        : undefined,
  });
}
function insideInstance(node: BaseNode): boolean {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (parent.type === "INSTANCE") return true;
  return false;
}
function inheritedStructure(key: string): boolean {
  return (
    key.startsWith("layout") ||
    key.startsWith("primaryAxis") ||
    key.startsWith("counterAxis") ||
    key.startsWith("padding") ||
    [
      "relativeTransform",
      "constraints",
      "vectorPaths",
      "vectorNetwork",
      "booleanOperation",
      "isMask",
      "maskType",
      "clipsContent",
      "itemSpacing",
      "itemReverseZIndex",
      "strokesIncludedInLayout",
      "minWidth",
      "maxWidth",
      "minHeight",
      "maxHeight",
      "numberOfFixedChildren",
      "textAutoResize",
    ].includes(key)
  );
}

export async function restore(
  api: PluginAPI,
  node: SceneNode,
  snapshot: NodeSnapshot,
): Promise<void> {
  const p = snapshot.props,
    inherited = insideInstance(node);
  if (node.type === "INSTANCE" && p.mainComponentId) {
    const master = await api.getNodeByIdAsync(p.mainComponentId);
    if (master?.type !== "COMPONENT")
      throw new Error("Recovery component unavailable");
    if ((await node.getMainComponentAsync())?.id !== master.id)
      node.swapComponent(master);
    node.removeOverrides();
  }
  if (node.type === "TEXT") {
    const fonts: FontName[] = (p.segments ?? []).map((s: Sketch) => s.fontName);
    if (typeof node.fontName !== "symbol") fonts.push(node.fontName);
    for (const font of fonts) await api.loadFontAsync(font);
  }
  const parent = snapshot.parentId
    ? await api.getNodeByIdAsync(snapshot.parentId)
    : null;
  if (
    parent &&
    parent.type !== "DOCUMENT" &&
    "insertChild" in parent &&
    !inherited &&
    (node.parent?.id !== parent.id ||
      parent.children.findIndex((child) => child.id === node.id) !==
        snapshot.index)
  )
    parent.insertChild(Math.min(snapshot.index, parent.children.length), node);
  if (
    "resize" in node &&
    !inherited &&
    p.width > 0 &&
    p.height > 0 &&
    (node.width !== p.width || node.height !== p.height)
  )
    node.resize(p.width, p.height);
  // Restore flow before fields whose setters require Auto Layout. Freeform
  // containers expose default values for some of these fields but reject writes.
  if (
    "layoutMode" in node &&
    !inherited &&
    p.layoutMode !== undefined &&
    node.layoutMode !== p.layoutMode
  )
    node.layoutMode = p.layoutMode;
  if (
    node.type === "VECTOR" &&
    p.vectorNetwork &&
    !inherited &&
    !sameValue(node.vectorNetwork, p.vectorNetwork)
  )
    await node.setVectorNetworkAsync(p.vectorNetwork);
  const restorationErrors: string[] = [];
  for (const [key, value] of Object.entries(p)) {
    // Instance descendant geometry and flow belong to the restored master.
    // A snapshot taken after a master mutation can contain its propagated
    // geometry, which must not be turned into forbidden instance overrides.
    if (inherited && inheritedStructure(key)) continue;
    if (
      [
        "type",
        "mainComponentId",
        "width",
        "height",
        "segments",
        "variableBindings",
        "vectorNetwork",
        "fillStyleId",
        "strokeStyleId",
        "effectStyleId",
        "textStyleId",
        "reactions",
      ].includes(key)
    )
      continue;
    if (key === "vectorPaths" && node.type === "VECTOR" && p.vectorNetwork)
      continue;
    if (key in node && !sameValue((node as unknown as Sketch)[key], value))
      try {
        (node as unknown as Sketch)[key] = value;
      } catch (e) {
        restorationErrors.push(`${key}: ${e}`);
      }
  }
  if ("setFillStyleIdAsync" in node)
    await node.setFillStyleIdAsync(p.fillStyleId ?? "");
  if ("setStrokeStyleIdAsync" in node)
    await node.setStrokeStyleIdAsync(p.strokeStyleId ?? "");
  if ("setEffectStyleIdAsync" in node)
    await node.setEffectStyleIdAsync(p.effectStyleId ?? "");
  if (node.type === "TEXT") await node.setTextStyleIdAsync(p.textStyleId ?? "");
  if ("setReactionsAsync" in node)
    await node.setReactionsAsync(p.reactions ?? []);
  if (node.type === "TEXT")
    for (const seg of p.segments ?? []) {
      const a = seg.start,
        b = seg.end;
      if (b <= a) continue;
      if (node.getRangeTextStyleId(a, b) !== seg.textStyleId)
        await node.setRangeTextStyleIdAsync(a, b, seg.textStyleId ?? "");
      if (node.getRangeFillStyleId(a, b) !== seg.fillStyleId)
        await node.setRangeFillStyleIdAsync(a, b, seg.fillStyleId ?? "");
      if (!sameFont(node.getRangeFontName(a, b), seg.fontName))
        node.setRangeFontName(a, b, seg.fontName);
      if (!sameValue(node.getRangeFontSize(a, b), seg.fontSize))
        node.setRangeFontSize(a, b, seg.fontSize);
      if (!samePaints(node.getRangeFills(a, b), seg.fills))
        node.setRangeFills(a, b, seg.fills);
      if (!sameValue(node.getRangeLetterSpacing(a, b), seg.letterSpacing))
        node.setRangeLetterSpacing(a, b, seg.letterSpacing);
      if (!sameValue(node.getRangeLineHeight(a, b), seg.lineHeight))
        node.setRangeLineHeight(a, b, seg.lineHeight);
      if (!sameValue(node.getRangeTextCase(a, b), seg.textCase))
        node.setRangeTextCase(a, b, seg.textCase);
      if (!sameValue(node.getRangeTextDecoration(a, b), seg.textDecoration))
        node.setRangeTextDecoration(a, b, seg.textDecoration);
      if (!sameValue(node.getRangeListOptions(a, b), seg.listOptions))
        node.setRangeListOptions(a, b, seg.listOptions);
      if (!sameValue(node.getRangeParagraphIndent(a, b), seg.paragraphIndent))
        node.setRangeParagraphIndent(a, b, seg.paragraphIndent);
      if (!sameValue(node.getRangeParagraphSpacing(a, b), seg.paragraphSpacing))
        node.setRangeParagraphSpacing(a, b, seg.paragraphSpacing);
      if (!sameValue(node.getRangeListSpacing(a, b), seg.listSpacing))
        node.setRangeListSpacing(a, b, seg.listSpacing);
      const fields: VariableBindableTextField[] = [
        "fontFamily",
        "fontStyle",
        "fontWeight",
        "fontSize",
        "letterSpacing",
        "lineHeight",
        "paragraphSpacing",
        "paragraphIndent",
      ];
      for (const field of fields) {
        const alias = seg.boundVariables?.[field],
          current = node.getRangeBoundVariable(a, b, field);
        if (alias || current) {
          const variable = alias
            ? await api.variables.getVariableByIdAsync(alias.id)
            : null;
          if (alias && !variable)
            restorationErrors.push(`Variable ${alias.id} disappeared`);
          else node.setRangeBoundVariable(a, b, field, variable);
        }
      }
    }
  for (const field of new Set([
    ...Object.keys(node.boundVariables ?? {}),
    ...Object.keys(p.variableBindings ?? {}),
  ])) {
    const existing = (node.boundVariables as Sketch)?.[field],
      previous = p.variableBindings?.[field];
    if (
      (existing &&
        !Array.isArray(existing) &&
        existing.type === "VARIABLE_ALIAS") ||
      previous
    ) {
      const variable = previous
        ? await api.variables.getVariableByIdAsync(previous.id)
        : null;
      if (previous && !variable)
        restorationErrors.push(`Variable ${previous.id} disappeared`);
      else node.setBoundVariable(field as VariableBindableNodeField, variable);
    }
  }
  for (const k of node.getPluginDataKeys())
    if (!(k in snapshot.plugin)) node.setPluginData(k, "");
  for (const [k, v] of Object.entries(snapshot.plugin))
    node.setPluginData(k, v);
  if (snapshot.children && "children" in node) {
    for (const [i, child] of snapshot.children.entries()) {
      const source = child.plugin["sketch2figma:sourceId"];
      const target =
        node.children.find(
          (n) => source && n.getPluginData("sketch2figma:sourceId") === source,
        ) ?? node.children[i];
      if (target)
        await restore(api, target, { ...child, parentId: node.id, index: i });
    }
  }
  if (restorationErrors.length) throw new Error(restorationErrors.join("; "));
}
export interface ResourceSnapshot {
  id: string;
  type: string;
  props: Sketch;
}
export interface PageSnapshot {
  name: string;
  guides: readonly Guide[];
  backgrounds: readonly Paint[];
  flowStartingPoints: readonly { nodeId: string; name: string }[];
  plugin: Record<string, string>;
  childOrder?: string[];
}
export interface JournalData {
  documentId: string;
  state: "running" | "recovery-needed";
  created: string[];
  resources: { id: string; type: string }[];
  snapshots: Record<string, NodeSnapshot>;
  previousIndex: ImportIndex;
  resourceSnapshots?: ResourceSnapshot[];
  pages?: Record<string, PageSnapshot>;
}
interface JournalHeader {
  storageVersion: 2;
  documentId: string;
  entries: number;
}
type JournalEntry =
  | { kind: "created"; id: string }
  | { kind: "resource"; value: JournalData["resources"][number] }
  | { kind: "snapshot"; id: string; value: NodeSnapshot }
  | { kind: "page"; id: string; value: PageSnapshot }
  | { kind: "resourceSnapshot"; value: ResourceSnapshot };

function clearJournalEntries(root: PluginDataMixin): void {
  for (const key of root.getPluginDataKeys())
    if (
      key.startsWith(`${NS}:journal-entry:`) ||
      key.startsWith(`${NS}:journal-index:`)
    )
      root.setPluginData(key, "");
}

/** Read both legacy whole-document journals and incremental recovery records. */
export function readJournal(api: Pick<PluginAPI, "root">): JournalData | null {
  const stored = readData<JournalData | JournalHeader | null>(
    api.root,
    "journal",
    null,
  );
  if (!stored || !("storageVersion" in stored)) return stored;
  if (
    stored.storageVersion !== 2 ||
    !Number.isSafeInteger(stored.entries) ||
    stored.entries < 0
  )
    throw new Error("Corrupted recovery journal header.");
  const previousIndex = readData<ImportIndex | null>(
    api.root,
    "journal-index",
    null,
  );
  if (!previousIndex || previousIndex.documentId !== stored.documentId)
    throw new Error("Corrupted recovery journal index.");
  const data: JournalData = {
    documentId: stored.documentId,
    state: "running",
    created: [],
    resources: [],
    snapshots: {},
    pages: {},
    resourceSnapshots: [],
    previousIndex,
  };
  for (let i = 0; i < stored.entries; i++) {
    const entry = readData<JournalEntry | null>(
      api.root,
      `journal-entry:${i}`,
      null,
    );
    if (!entry) throw new Error(`Missing recovery journal entry ${i}.`);
    switch (entry.kind) {
      case "created":
        data.created.push(entry.id);
        break;
      case "resource":
        data.resources.push(entry.value);
        break;
      case "snapshot":
        data.snapshots[entry.id] = entry.value;
        break;
      case "page":
        data.pages![entry.id] = entry.value;
        break;
      case "resourceSnapshot":
        data.resourceSnapshots!.push(entry.value);
        break;
      default:
        throw new Error(`Corrupted recovery journal entry ${i}.`);
    }
  }
  return data;
}
export class Journal {
  data: JournalData;
  private entries = 0;
  constructor(
    readonly api: PluginAPI,
    index: ImportIndex,
  ) {
    this.data = {
      documentId: index.documentId,
      state: "running",
      created: [],
      resources: [],
      snapshots: {},
      resourceSnapshots: [],
      pages: {},
      previousIndex: JSON.parse(JSON.stringify(index)),
    };
    clearJournalEntries(api.root);
    writeData(api.root, "journal-index", this.data.previousIndex);
    this.saveHeader();
  }
  private saveHeader(): void {
    writeData(this.api.root, "journal", {
      storageVersion: 2,
      documentId: this.data.documentId,
      entries: this.entries,
    } satisfies JournalHeader);
  }
  private append(entry: JournalEntry): void {
    // Persist this snapshot before its mutation, without rewriting every earlier
    // snapshot (quadratic storage traffic on large reimports).
    writeData(this.api.root, `journal-entry:${this.entries}`, entry);
    this.entries++;
    this.saveHeader();
  }
  track(node: BaseNode): void {
    this.data.created.push(node.id);
    this.append({ kind: "created", id: node.id });
  }
  trackResource(resource: BaseStyle | Variable | VariableCollection): void {
    const value = {
      id: resource.id,
      type:
        "resolvedType" in resource
          ? "VARIABLE"
          : "modes" in resource
            ? "COLLECTION"
            : "STYLE",
    };
    this.data.resources.push(value);
    this.append({ kind: "resource", value });
  }
  async before(node: SceneNode): Promise<void> {
    if (this.data.created.includes(node.id) || this.data.snapshots[node.id])
      return;
    const snapshot = capture(node, node.type === "INSTANCE");
    if (node.type === "INSTANCE")
      snapshot.props.mainComponentId = (await node.getMainComponentAsync())?.id;
    this.data.snapshots[node.id] = snapshot;
    this.append({ kind: "snapshot", id: node.id, value: snapshot });
  }
  beforePage(page: PageNode): void {
    if (this.data.created.includes(page.id) || this.data.pages?.[page.id])
      return;
    this.data.pages ??= {};
    this.data.pages[page.id] = {
      name: page.name,
      guides: page.guides,
      backgrounds: page.backgrounds,
      flowStartingPoints: page.flowStartingPoints,
      childOrder: page.children.map((child) => child.id),
      plugin: Object.fromEntries(
        page.getPluginDataKeys().map((k) => [k, page.getPluginData(k)]),
      ),
    };
    this.append({ kind: "page", id: page.id, value: this.data.pages[page.id] });
  }
  beforeResource(r: BaseStyle | Variable | VariableCollection): void {
    if (
      this.data.resources.some((s) => s.id === r.id) ||
      this.data.resourceSnapshots?.some((s) => s.id === r.id)
    )
      return;
    const props: Sketch = { name: r.name };
    const keys =
      "valuesByMode" in r
        ? ["valuesByMode", "scopes"]
        : "modes" in r
          ? ["modes"]
          : r.type === "PAINT"
            ? ["paints"]
            : r.type === "EFFECT"
              ? ["effects"]
              : r.type === "TEXT"
                ? [
                    "fontName",
                    "fontSize",
                    "lineHeight",
                    "letterSpacing",
                    "paragraphSpacing",
                    "paragraphIndent",
                    "textCase",
                    "textDecoration",
                  ]
                : [];
    for (const k of keys)
      props[k] = JSON.parse(JSON.stringify((r as unknown as Sketch)[k]));
    this.data.resourceSnapshots ??= [];
    const value = {
      id: r.id,
      type:
        "valuesByMode" in r
          ? "VARIABLE"
          : "modes" in r
            ? "COLLECTION"
            : "STYLE",
      props,
    };
    this.data.resourceSnapshots.push(value);
    this.append({ kind: "resourceSnapshot", value });
  }
  commit(): void {
    writeData(this.api.root, "journal", null);
    clearJournalEntries(this.api.root);
  }
  async rollback(): Promise<string[]> {
    return recover(this.api, this.data);
  }
}
export async function recover(
  api: PluginAPI,
  data: JournalData,
): Promise<string[]> {
  const errors: string[] = [];
  // Move old nodes out of newly created containers before cleanup can delete them.
  for (const [id, s] of Object.entries(data.snapshots))
    try {
      const n = await api.getNodeByIdAsync(id),
        p = s.parentId ? await api.getNodeByIdAsync(s.parentId) : null;
      if (
        n &&
        "visible" in n &&
        p &&
        p.type !== "DOCUMENT" &&
        "insertChild" in p &&
        !insideInstance(n) &&
        (n.parent?.id !== p.id ||
          p.children.findIndex((child) => child.id === n.id) !== s.index)
      )
        p.insertChild(Math.min(s.index, p.children.length), n as SceneNode);
    } catch (e) {
      errors.push(`Relocate ${id}: ${e}`);
    }
  for (const id of [...data.created].reverse()) {
    try {
      const node = await api.getNodeByIdAsync(id);
      if (node && !node.removed) node.remove();
    } catch (e) {
      errors.push(`Remove ${id}: ${e}`);
    }
  }
  for (const [id, s] of Object.entries(data.snapshots)) {
    try {
      const node = await api.getNodeByIdAsync(id);
      if (node && "visible" in node) await restore(api, node as SceneNode, s);
    } catch (e) {
      errors.push(`Restore ${id}: ${e}`);
    }
  }
  for (const [id, s] of Object.entries(data.pages ?? {}))
    try {
      const p = await api.getNodeByIdAsync(id);
      if (p?.type === "PAGE") {
        p.name = s.name;
        p.guides = s.guides;
        p.backgrounds = s.backgrounds;
        p.flowStartingPoints = s.flowStartingPoints;
        for (const k of p.getPluginDataKeys())
          p.setPluginData(k, s.plugin[k] ?? "");
        for (const [k, v] of Object.entries(s.plugin)) p.setPluginData(k, v);
      }
    } catch (e) {
      errors.push(`Page ${id}: ${e}`);
    }
  // Earlier moves change later siblings' captured indices. The parent's original
  // order is authoritative and must be restored after all node relocations.
  for (const [id, snapshot] of [
    ...Object.entries(data.snapshots),
    ...Object.entries(data.pages ?? {}),
  ]) {
    if (!snapshot.childOrder) continue;
    try {
      const parent = await api.getNodeByIdAsync(id);
      if (
        !parent ||
        !("children" in parent) ||
        parent.type === "DOCUMENT" ||
        parent.type === "INSTANCE" ||
        insideInstance(parent)
      )
        continue;
      for (const [index, childId] of snapshot.childOrder.entries()) {
        const child = parent.children.find((node) => node.id === childId);
        if (!child) throw new Error(`Original child ${childId} is missing`);
        if (parent.children[index]?.id !== childId)
          parent.insertChild(index, child);
      }
    } catch (error) {
      errors.push(`Restore order ${id}: ${error}`);
    }
  }
  for (const s of [...(data.resourceSnapshots ?? [])].reverse())
    try {
      const r =
        s.type === "VARIABLE"
          ? await api.variables.getVariableByIdAsync(s.id)
          : s.type === "COLLECTION"
            ? await api.variables.getVariableCollectionByIdAsync(s.id)
            : await api.getStyleByIdAsync(s.id);
      if (!r) throw new Error("Resource disappeared");
      r.name = s.props.name;
      if ("valuesByMode" in r) {
        r.scopes = s.props.scopes;
        for (const [mode, value] of Object.entries(s.props.valuesByMode))
          r.setValueForMode(mode, value as VariableValue);
      } else if ("modes" in r) {
        for (const mode of [...r.modes])
          if (!s.props.modes.some((m: Sketch) => m.modeId === mode.modeId))
            r.removeMode(mode.modeId);
        for (const m of s.props.modes) r.renameMode(m.modeId, m.name);
      } else {
        if (r.type === "TEXT") await api.loadFontAsync(s.props.fontName);
        for (const [key, value] of Object.entries(s.props))
          (r as unknown as Sketch)[key] = value;
      }
    } catch (e) {
      errors.push(`Restore resource ${s.id}: ${e}`);
    }
  for (const r of [...data.resources].reverse())
    try {
      const resource =
        r.type === "VARIABLE"
          ? await api.variables.getVariableByIdAsync(r.id)
          : r.type === "COLLECTION"
            ? await api.variables.getVariableCollectionByIdAsync(r.id)
            : await api.getStyleByIdAsync(r.id);
      if (resource) resource.remove();
    } catch (e) {
      errors.push(`Resource ${r.id}: ${e}`);
    }
  writeIndex(api, data.previousIndex);
  if (errors.length) {
    data.state = "recovery-needed";
    writeData(api.root, "journal", data);
  } else writeData(api.root, "journal", null);
  clearJournalEntries(api.root);
  return errors;
}
export async function mapping(
  node: SceneNode,
  s: Sketch,
  conversionHash: string,
  pass?: FingerprintPass,
): Promise<StoredMapping> {
  return {
    nodeId: node.id,
    sourceHash: fingerprint(s),
    conversionHash,
    targetHash: await targetFingerprint(node, 2, pass),
    targetHashVersion: 2,
    type: node.type,
  };
}
