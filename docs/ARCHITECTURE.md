# Architecture audit — 2026-10-08

## Contract
The 13-section user specification is the product contract. API type availability is evidence of a writable surface, not evidence of visual fidelity. This project must never claim lossless conversion or production readiness from unit tests alone. Unknown properties remain visible in the conversion report, including schema additions in newer Sketch releases.

## Boundaries
1. Browser worker: bounded ZIP inspection, UTF-8 JSON decoding, document/version validation, source indexing, asset extraction. No Figma writes and no network access.
2. Core: immutable source objects, exact JSON-pointer leaf inventory, conversion ledger, dependency ordering, selection closure, stable identity, conflict planning, geometric/color math. Pure, testable code.
3. Figma adapter: narrow native node creation; fonts loaded before text writes; separate resource, geometry, appearance, typography, layout, Symbol, and prototype passes. Current official plugin typings are a compile-time gate.
4. Orchestrator: import one file transaction at a time, yield between layers, cancellation token, persistent journal, recovery, reimport identity. Failures are reported per property and layer. A failed or cancelled file removes newly created nodes/resources and restores modified nodes where supported; cleanup failures remain in the journal for recovery.
5. UI: centered file drop area, batch queue, unused-resource switches, token JSON drag and drop, missing-font blocking, compact progress/results, and cancellation. Required dependencies always override resource exclusions. Advanced controls were removed at the user’s request.
6. Validation: source-to-target structural snapshot, counts, hierarchy, dimensions, rotation, component links, text, resources, reactions, responsive baseline requirements, pixel comparison when reference renders are supplied.

## Fidelity ledger
Every scalar, null, empty object, and empty array is enumerated using escaped JSON pointers. Default outcome is Unsupported. A converter records Native, Editable Equivalent, Visual Equivalent, Partial, or Unsupported only for paths whose handling is known. Merely retaining metadata is not a visual conversion. A failed setter cannot leave a Native claim behind. Reports include observed properties even if the layer was not selected (explicitly marked outside import scope).

Source identifiers are namespaced by document ID, never file name. Source JSON is chunked into plugin data on imported nodes; document snapshots and resource mappings live on the document root. Embedded images are retained by Figma image hashes. Keep the original local Sketch archive; there is no archive-download control in the panel. Full per-file audits are compressed and chunked on the document root, with storage failures reported. The plugin makes no network requests; converted Figma content and native image assets follow Figma’s normal file storage. Original oversized raster pixels are retained as native PNG tiles; browser color-profile decoding differences are reported.

## Incremental imports and conflicts
Use source ID plus source fingerprint and target snapshot fingerprint. Repeated unchanged imports reuse mappings. Target changes are detected before applying source changes. Preserve-local is the safe default. Replace-imported remains an explicit importer API option; the panel uses preserve-local. Deleted source nodes are retained and reported unless deletion is specifically enabled. Source changes requiring incompatible node types are reported; component replacement must avoid silently orphaning existing instances. Shared resources are keyed by source ID and deduplicated; cross-file component reuse is explicit, never name-only.

## Dependency strategy
Index local and foreign Symbol masters, including supplied library archives. Populate dependency components before their consumers. Detect cycles and unresolved references before writes. Never substitute an unrelated component by name. Overrides target source paths inside linked instances, not globally matching layer names. Unknown override kinds retain source metadata and a finding.

## Destructive fallback policy
No automatic flattening, outlining text, or rasterization. Unknown layers become visibly named editable frames with source geometry; that is Partial/Unsupported content, not a faithful visual equivalent. The first implementation exposes unsupported properties and preserves source metadata. Future destructive fallback requires per-operation approval with a preview; a general import action cannot grant it.

## Risks and release gates
- Official Sketch schema/reference repositories are archived and omit recent Stack/Glass schemas. New source fields are detected but cannot be certified from undocumented assumptions.
- Figma Group bounds are derived; source groups use fixed-bound editable frames to prevent recursive resize drift observed in native Figma validation.
- Figma masks propagate through following siblings and stop at clip-content frames. Mask chains need bounded wrappers; outline masks require a separate copy of their visible source artwork.
- Font family/style matching differs from PostScript names. Font replacement is always reported.
- Rich text metrics, gradient interpolation, color profiles, boolean ordering, Smart Layout, and component overrides require real-render comparisons.
- Multi-property mutations and document crashes are not ACID transactions. Journaled recovery is best effort and must be tested, never described as guaranteed atomicity.
- Production release requires Figma Desktop installation, real Sketch renders for pixel baselines, additional Stack distribution/responsive cases beyond Test version 196, interruption tests, published-library access tests, multi-mode variable tests, and performance budgets on large real documents.

## Implementation stages
A: archive/preflight/ledger; B: hierarchy/geometry/vectors; C: paints/effects/images/text; D: resources/Symbols/overrides; E: layouts/prototypes; F: reimport/recovery; G: management UI/audits/visual QA. Each stage adds regression evidence. Feature checklist differentiates Implemented, Partial, Unsupported, and Unverified.

## Primary references
- https://developers.figma.com/docs/plugins/api/
- https://github.com/figma/plugin-typings (installed @figma/plugin-typings 1.141.0)
- https://developer.sketch.com/file-format/
- https://github.com/sketch-hq/sketch-document (archived 2025-04-10)
- https://github.com/sketch-hq/sketch-reference-files (official serialized fixtures)

## Style finalization and converter upgrades

`text-style-bindings.ts` reconciles final UTF-16 ranges against explicit source relationships. `text-style-values.ts` captures and verifies the native typography and alias fields. Matching ranges use original styles; semantic overrides retain original links only when readback confirms both values and IDs. The current converter retains exact source typography and explicitly reports incompatible style bindings; it does not generate additional Text Styles. `instance-text-styles.ts` resolves nested swaps and outer override precedence without conflating instance and master audits. Reconciliation runs after token bindings as well as initial text conversion. Literal text and historical detach metadata never imply a style.

Every stored source-node/resource mapping records the converter/configuration fingerprint. An unchanged source archive is refreshed when converter revision or user mappings change, retaining node/resource identity and respecting local-edit policy. Figma resets root-instance plugin metadata during `removeOverrides`; source identifiers are reapplied before resolving containing instances' override paths.


## Repository entry points

`manifest.json` points to the main importer build in `dist/plugin.js` and `dist/ui.html`. `scripts/build.mjs` builds this single plugin. Current importer regressions and their fixture helpers live under `tests/`; none are imported by production source. `scripts/compare-renders.mjs` supports standalone PNG comparisons. Generated dependencies are installed with `npm ci` when developing.

## Resource scope and layout verification

`resource-selection.ts` computes the dependency closure for selected layers, nested Symbol swaps, style overrides, named colors, supplied token bindings, and aliases across all modes. Switches omit unused definitions only; excluded source definitions remain in metadata and the audit. Unused styles do not block imports on their fonts when excluded.

Serialized Stack ordering uses Sketch’s actual `FirstOnTop=0` / `LastOnTop=1` enum, checked against the installed Sketch API. Per-axis `minSize`/`maxSize` strings map to native limits; zero axes remove the limit. Border-inclusive layout maps to Figma’s border-box flag and remains Partial when enabled: Sketch’s child protruding-border calculation is not assumed identical. `detail-validation.ts` reads back Stack padding/gaps/order, size limits, radii, stroke geometry, inherited component layouts, and component layout aliases after conversion. Setter success alone does not certify preservation.
