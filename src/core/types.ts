/** Bump when a conversion fix must be applied to unchanged imported source nodes. */
export const CONVERTER_REVISION = 10;

/** Sketch is deliberately open: future schema fields must survive inspection. */
export type Sketch = Record<string, any>;
export type Fidelity =
  | "Native"
  | "Editable Equivalent"
  | "Visual Equivalent"
  | "Partial"
  | "Unsupported";
export interface PropertyResult {
  path: string;
  status: Fidelity;
  reason: string;
}
export interface Finding {
  resource?: ResourceKind;
  code: string;
  message: string;
  sourceId?: string;
  path?: string;
  severity: "info" | "warning" | "error";
}
export interface LayerAudit {
  sourceId: string;
  name: string;
  sourceType: string;
  targetId?: string;
  selected: boolean;
  properties: PropertyResult[];
}
export interface Validation {
  resource?: ResourceKind;
  kind: string;
  sourceId?: string;
  passed: boolean | null;
  expected?: unknown;
  actual?: unknown;
  message: string;
}
export interface ConversionReport {
  schemaVersion: 1;
  file: string;
  documentId: string;
  sourceVersion: number;
  startedAt: string;
  finishedAt?: string;
  state: "running" | "complete" | "cancelled" | "failed";
  layers: LayerAudit[];
  findings: Finding[];
  validations: Validation[];
  totals: Record<Fidelity, number>;
  created: number;
  reused: number;
  updated: number;
  preserved: number;
  visualValidation: "not-run" | "partial" | "passed" | "failed";
  apiVersion: string;
  sourceMetadataPreserved: boolean;
}
export interface Asset {
  path: string;
  bytes: Uint8Array;
  originalByteLength?: number;
  tiles?: {
    width: number;
    height: number;
    items: {
      path: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  };
}
export interface SketchFile {
  name: string;
  documentId: string;
  version: number;
  document: Sketch;
  meta: Sketch;
  user: Sketch;
  pages: Sketch[];
  assets: Asset[];
  digest: string;
  warnings: Finding[];
}
export interface Preflight {
  file: string;
  documentId: string;
  version: number;
  pages: { id: string; name: string; layers: PreviewLayer[]; count: number }[];
  symbols: { id: string; name: string }[];
  fonts: string[];
  images: number;
  missingImages: string[];
  missingSymbols: string[];
  styleCount: number;
  colorCount: number;
  warnings: Finding[];
}
export interface PreviewLayer {
  id: string;
  name: string;
  type: string;
  children: PreviewLayer[];
}
export type ResourceKind =
  "colors" | "layerStyles" | "textStyles" | "components" | "tokens";
export interface ImportOptions {
  selectedIds: string[];
  resources: boolean;
  resourceTypes?: Partial<Record<ResourceKind, boolean>>;
  destinationPageId?: string;
  conflict: "preserve-local" | "replace-imported";
  fontMap: Record<string, FontName>;
  componentMap: Record<string, string>;
  styleMap: Record<string, string>;
  variableMap: Record<string, string>;
  fallbackFont?: FontName;
  tokens?: TokenFile;
  generatePrototypePage: boolean;
}
export interface Token {
  name: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  values: Record<
    string,
    string | number | boolean | { r: number; g: number; b: number; a?: number }
  >;
}
export interface TokenFile {
  collection: string;
  modes: string[];
  tokens: Token[];
  bindings?: { sourceId: string; field: string; token: string }[];
}
export interface StoredMapping {
  conversionHash?: string;
  nodeId: string;
  sourceHash: string;
  targetHash: string;
  targetHashVersion?: 2;
  type: string;
}
export interface ImportIndex {
  version: 1;
  documentId: string;
  nodes: Record<string, StoredMapping>;
  pages: Record<string, string>;
  resources: Record<string, string>;
  assets: Record<string, string>;
  sourceDigest: string;
  resourceStates?: Record<
    string,
    { sourceHash: string; targetHash: string; conversionHash?: string }
  >;
  resourceAudits?: Record<string, LayerAudit>;
}
export const DEFAULT_OPTIONS: ImportOptions = {
  selectedIds: [],
  resources: true,
  conflict: "preserve-local",
  fontMap: {},
  componentMap: {},
  styleMap: {},
  variableMap: {},
  generatePrototypePage: false,
};
export const sourceId = (s: Sketch): string =>
  String(s.do_objectID ?? s.symbolID ?? "");
export function walkLayers(pages: Sketch[]): Sketch[] {
  const out: Sketch[] = [];
  const visit = (n: Sketch) => {
    out.push(n);
    for (const c of n.layers ?? []) visit(c);
  };
  for (const p of pages) visit(p);
  return out;
}
export function ownSource(s: Sketch): Sketch {
  const { layers, ...own } = s;
  return {
    ...own,
    ...(layers ? { childSourceIds: layers.map(sourceId) } : {}),
  };
}
