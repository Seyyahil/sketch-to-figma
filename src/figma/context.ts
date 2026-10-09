import type { ResourceSelection } from "../core/resource-selection";
import { Ledger } from "../core/audit";
import { fingerprint, rgba } from "../core/math";
import {
  CONVERTER_REVISION,
  ownSource,
  sourceId,
  type ConversionReport,
  type Finding,
  type ImportIndex,
  type ImportOptions,
  type Sketch,
  type SketchFile,
} from "../core/types";
export interface ResourceSet {
  paints: Map<string, Paint[]>;
  strokes: Map<string, Paint[]>;
  effects: Map<string, EffectStyle>;
  texts: Map<string, TextStyle>;
  variables: Map<string, Variable>;
  components: Map<string, ComponentNode>;
}
export interface MutationJournal {
  track(node: BaseNode): void;
  trackResource(resource: BaseStyle | Variable | VariableCollection): void;
  before(node: SceneNode): Promise<void>;
  beforeResource?(resource: BaseStyle | Variable | VariableCollection): void;
}
export class ImportContext {
  resources: ResourceSet = {
    paints: new Map(),
    strokes: new Map(),
    effects: new Map(),
    texts: new Map(),
    variables: new Map(),
    components: new Map(),
  };
  nodes = new Map<string, SceneNode>();
  ledgers = new Map<string, Ledger>();
  fonts: Font[] = [];
  imageHashes = new Map<string, string>();
  resourceSelection?: ResourceSelection;
  processed = new Set<string>();
  cancelled = false;
  readonly conversionHash: string;
  cleanup = new Set<SceneNode>();
  constructor(
    readonly api: PluginAPI,
    readonly file: SketchFile,
    readonly options: ImportOptions,
    readonly report: ConversionReport,
    readonly index: ImportIndex,
    readonly journal: MutationJournal,
    readonly progress: (done: number, name: string) => void,
  ) {
    this.conversionHash = fingerprint({
      revision: CONVERTER_REVISION,
      fontMap: options.fontMap,
      fallbackFont: options.fallbackFont,
      componentMap: options.componentMap,
      styleMap: options.styleMap,
      variableMap: options.variableMap,
      resourceTypes: options.resourceTypes,
      sourceColorSpace: file.document.colorSpace,
      targetColorProfile: api.root.documentColorProfile,
    });
  }
  ledger(s: Sketch, selected = true): Ledger {
    const id = sourceId(s);
    let l = this.ledgers.get(id);
    if (!l) {
      l = new Ledger(ownSource(s), {
        sourceId: id,
        name: s.name ?? s._class ?? id,
        sourceType: s._class ?? "document",
        selected,
        properties: [],
      });
      this.ledgers.set(id, l);
    }
    return l;
  }
  finding(
    code: string,
    message: string,
    s?: Sketch,
    path?: string,
    severity: Finding["severity"] = "warning",
    resource?: Finding["resource"],
  ): void {
    this.report.findings.push({
      code,
      message,
      sourceId: s ? sourceId(s) : undefined,
      path,
      severity,
      ...(resource
        ? { resource }
        : s?._class === "sharedStyle"
          ? {
              resource: s.value?.textStyle
                ? ("textStyles" as const)
                : ("layerStyles" as const),
            }
          : {}),
    });
  }
  async attempt(
    s: Sketch,
    path: string,
    fn: () => void | Promise<void>,
    keys: string[] = [],
    status: "Native" | "Editable Equivalent" | "Partial" = "Native",
    reason?: string,
  ): Promise<boolean> {
    const checkpoint = this.ledger(s).checkpoint();
    try {
      await fn();
      if (keys.length) this.ledger(s).fields(path, keys, status, reason);
      else this.ledger(s).mark(path, status, reason);
      return true;
    } catch (e) {
      this.ledger(s).rollback(checkpoint);
      this.finding("API_REJECTED", `${String(e)}`, s, path, "error");
      return false;
    }
  }
  color(c: Sketch): RGBA {
    const sourceP3 = this.file.document.colorSpace === 2;
    const targetP3 = this.api.root.documentColorProfile === "DISPLAY_P3";
    if (sourceP3 && !targetP3) return rgba(c, true);
    if (!sourceP3 && targetP3) {
      const v = rgba(c),
        lin = (x: number) =>
          x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
        enc = (x: number) =>
          x <= 0.0031308
            ? 12.92 * x
            : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055,
        R = lin(v.r),
        G = lin(v.g),
        B = lin(v.b);
      return {
        r: enc(0.82259287 * R + 0.17753395 * G),
        g: enc(0.03319951 * R + 0.9667835 * G),
        b: enc(0.01708535 * R + 0.07239572 * G + 0.91030148 * B),
        a: v.a,
      };
    }
    return rgba(c);
  }
  async tick(s: Sketch): Promise<void> {
    if (this.cancelled) throw new Error("IMPORT_CANCELLED");
    this.progress(this.processed.size, s.name ?? s._class);
    await new Promise((r) => setTimeout(r, 0));
    if (this.cancelled) throw new Error("IMPORT_CANCELLED");
  }
  finish(): void {
    this.report.layers = [...this.ledgers.values()].map((l) => l.finalize());
  }
}
