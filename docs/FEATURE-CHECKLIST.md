# Authoritative 13-section acceptance checklist

Verbatim requirements supplied by Hakan. All **203 original requirements** remain release gates; current UI and resource policies are recorded separately. Unsupported or unimplemented requirements are not deleted. **The full specification is not yet satisfied; no production-ready or 100% lossless claim is made.**

Reviewed against the repository source and tests on **2026-10-09**, converter revision **10**. The last recorded `npm run check` passed **202 tests across 14 files**, TypeScript and the production build; that run is documented in [VALIDATION.md](VALIDATION.md). This documentation refresh did not rerun the suite or modify Figma. Current native rendering, binding and responsive acceptance remain open.

“Implemented” describes a code path, not full native acceptance. Current automated evidence uses a separately supplied **Test.sketch** acceptance archive and isolated in-memory inputs with a Figma host double/mocked image decoder. It does not render Figma. Deleted public/native captures are not active regression coverage. Historical native/render summaries remain in [VALIDATION.md](VALIDATION.md); they do not certify the current build. API/type evidence refers to installed `@figma/plugin-typings` **1.141.0**, not a fresh review of every current API feature.

## Current product behavior and recent additions

The panel imports whole files with five switches for **unused** Color variables, Layer styles, Text styles, Symbols and Tokens. Required dependencies remain included. Exact source names/slashes are retained, literal colors remain literal, and numeric layout values do not become inferred tokens. The current converter creates original Text Styles and compatible Effect Styles, but no Color/Paint Styles or additional override Text Styles. Incompatible text overrides preserve their exact values and original relationship metadata with explicit findings; complete native Text Style binding remains unresolved.

| Feature | Current behavior | Implementation / automated evidence |
|---|---|---|
| Minimal themed panel | Centered drop area, file queue, five switches and Import/Cancel. Uses Figma theme colors in an HTML panel. | `src/ui/index.html`, `theme.css`, `main.ts`; `tests/ui.test.ts`. |
| Reading and preparation indicator | Per-file indeterminate loading bar across Reading/Preparing; accessible label and reduced-motion fallback. Removed when ready, failed or removed; no fabricated percentage. | `src/ui/main.ts`, `theme.css`; UI state and real Test.sketch preparation regressions. |
| Sketch-to-Figma transfer indicator | Moving dashed line and floating file icons between the Sketch and Figma marks during import; reduced-motion fallback. | `src/ui/index.html`, `theme.css`, `main.ts`; import state regressions, not native animation certification. |
| Host message handling | Validated pluginMessage payloads accept nested Figma senders; stale import requests are ignored and preparation status clears. | `src/ui/plugin-messages.ts`, `main.ts`; `tests/ui.test.ts`. |
| Resource-focused report | Five resource categories drive the screen, completion status and button counts. Geometry never enters these totals; paired findings become notes without double-counting. Unverified resources and fatal errors stay visible. | `src/ui/report-model.ts`, `report-view.ts`; `tests/report-model.test.ts`, `ui.test.ts`. |
| Compact report navigation | Accordion padding/spacing, count badges and Details; clickable names select affected layers. Saved audits load on demand after reopening, without another import. Empty categories do not claim acceptance. | `src/ui/report-view.ts`, `theme.css`, `src/plugin.ts`; `tests/report-panel.test.ts`, `ui.test.ts`. |
| Required resource and token closure | Switches affect unused definitions; nested Symbol/style swaps and mode-specific token aliases required by layers stay included. | `src/core/resource-selection.ts`, `src/figma/token-bindings.ts`; `tests/resource-selection.test.ts`. |
| Source resource repair | Source colors are restored/read back on reimport, except explicit mappings. Compatible original Text Styles are reconciled per range and instance; source-only legacy resource cleanup respects references/local edits. | `src/figma/resources.ts`, `text-style-bindings.ts`, `instance-text-styles.ts`; color and binding tests. |
| Global boolean conversion | None compounds preserve winding/holes; explicit operations preserve operand order. Editable originals and source IDs survive copies, reimport and rollback; copy/live-edit limitations are reported. | `src/core/compound-paths.ts`, `src/figma/booleans.ts`; global boolean and all-73-compound Test.sketch tests. |
| Geometry-aware full audit | Path bounds, Bezier extrema, transform equivalence and wrapper origins replace raw-frame comparisons. Strict measurements stay in the stored audit, outside the resource report. | `src/figma/geometry-validation.ts`; geometry unit and validation integration tests. |
| Original-resolution oversized images | PNG/JPEG assets exceeding 4096px on either axis use image tiles, retaining source crop/mask and asset identity. This is an editable equivalent, not a single native image or pixel certification. | `src/ui/asset-preparation.ts`, `src/figma/tiled-images.ts`; `tests/images.test.ts`, `ui.test.ts`. |

The repository has one plugin entry point, `manifest.json`. Native QA manifests/pages, production synthetic fixture imports, attachment/mapping/preview controls and report/reference-render export controls are absent. Test.sketch is excluded from publication and supplied through `SKETCH_FIXTURE`; without it, acceptance cases explicitly skip while unit tests run. The deleted `tests/fixtures` folder is not required. Production builds retain only `dist/plugin.js` and `dist/ui.html`; debug maps are limited to `npm run dev`. Generated dependencies and scratch renders/reports are not retained in the repository.

## 1. Files and Document Structure

| ID | Requirement | Implementation and verification |
|---|---|---|
| 1.01 | Import entire Sketch files or selected pages, artboards, frames, and graphics. | Partial; whole-file import in the panel. Selective page/layer scope remains in the importer API; selection UI removed at the user’s request. |
| 1.02 | Batch import multiple `.sketch` files into Figma. | Implemented batch queue and sequential imports in the main panel. Queue, revision replacement and cancellation have UI logic regressions; current native host interaction acceptance remains open. |
| 1.03 | Support compatible Sketch document versions and file structures. | Partial; the separately supplied regression archive is Test.sketch, version 196. Other exercised public versions are historical evidence, not retained regression fixtures. Pre-ZIP, multi-disk and full ZIP64 directory formats are rejected explicitly. |
| 1.04 | Preserve page names, order, and canvas backgrounds. | Partial; names and solid backgrounds handled. Reordering existing pages on changed source order is not yet implemented. |
| 1.05 | Preserve frames, groups, nested groups, and layer hierarchy. | Editable Equivalent; groups use fixed-bounds frames. Current importer tests check source hierarchy; historical native counts are summarized in VALIDATION.md. Current native acceptance remains open. |
| 1.06 | Preserve layer names, types, stacking order, and parent-child relationships. | Partial; source names, parent links and stacking retained; Auto Layout flow uses reversed children plus first-on-top stacking. |
| 1.07 | Preserve positions, dimensions, rotations, flips, and transformations. | Partial; transforms and geometry-aware readback are implemented. Historical native discrepancies do not certify the current build. Strict geometry checks remain in the stored audit, excluded from the panel and its counts. |
| 1.08 | Preserve visibility, locking, clipping, and opacity settings. | Partial; visibility, locking and opacity use native setters, with clipping frames and mask wrappers where needed. Unsupported source settings remain in the property ledger; native appearance acceptance remains open. |
| 1.09 | Preserve original Sketch layer identifiers and metadata. | Implemented; chunked source identities and original values stored; metadata and repeat-import regressions. |
| 1.10 | Import frame and graphic templates. | Unsupported semantic behavior; template flags retained in metadata. No Figma template relationship is invented. |
| 1.11 | Preserve source color-profile information and convert colors accurately. | Partial; explicit sRGB/P3 conversion and original profile metadata. Gamut and browser image decoding require visual comparison. |
| 1.12 | Detect corrupted, incomplete, or incompatible Sketch files. | Implemented CRC, central/local-header consistency, size/overlap limits and malformed archive rejection; acceptance tests parse a separately supplied Test.sketch. Parsing success does not certify conversion fidelity. |

## 2. Canvas, Frames, Grids, and Guides

| ID | Requirement | Implementation and verification |
|---|---|---|
| 2.01 | Convert Sketch artboards and frames into Figma frames. | Implemented; native frames. Source groups with Frame behavior also convert to frames. |
| 2.02 | Preserve frame backgrounds, borders, and clipping. | Partial; frame paints, strokes and clipping use native setters in appearance.ts, geometry.ts and layout.ts. Strict readback and source metadata remain; rendered clipping and border fidelity need native acceptance. |
| 2.03 | Preserve absolute coordinates and relative positioning. | Partial; source transforms and parent-relative placement are implemented. geometry-validation.ts accounts for path origins and anonymous wrappers; native layout and rendered placement remain unverified for the current build. |
| 2.04 | Preserve frame dimensions and resizing behavior. | Partial; source fixed bounds and resizing rules handled; native Fit/Fill cycles preserve fixed source bounds with a finding. |
| 2.05 | Convert column, row, and square layout grids. | Implemented setter; square and row/column grids. Native Test lacks grid acceptance coverage. |
| 2.06 | Preserve grid margins, gutters, counts, and alignment. | Partial; common grid dimensions/alignment mapped; row interpretation and nonuniform layouts need source-render fixtures. |
| 2.07 | Preserve guide positions and supported guide settings. | Implemented positions; `guides` writable API. Unsupported guide UI settings remain metadata. |
| 2.08 | Preserve nested frame and clipping relationships. | Partial; nested frames and mask/clipping wrappers are implemented. Source hierarchy and wrapper coordinates have regressions; native nested clipping and recovery acceptance remains open. |

## 3. Components, Symbols, and Libraries

| ID | Requirement | Implementation and verification |
|---|---|---|
| 3.01 | Convert Symbol Sources into reusable Figma components. | Implemented native component creation; the current Test.sketch regressions cover all 49 Symbol Sources. Host-double checks do not certify native appearance or typography bindings. |
| 3.02 | Convert Symbol instances into linked Figma instances. | Implemented linked native instances; current Test.sketch regressions cover 49 instances and repeat identity. Native component-link results are historical; current instance typography acceptance remains open. |
| 3.03 | Preserve nested Symbols and source-instance relationships. | Implemented nested relationships, source-path traversal and swaps; bindings.test.ts covers effective source styles and actual instance descendants. Incompatible typography can still lose its original Text Style binding and is reported. |
| 3.04 | Preserve text, image, color, tint, and style overrides. | Partial; text/image/color/style overrides implemented. Inherited tint and oversized image override cases remain incomplete. |
| 3.05 | Preserve nested Symbol swaps and instance overrides. | Implemented; ancestor swaps precede descendant overrides; removed source overrides reset on reimport; regressions. |
| 3.06 | Preserve layer visibility overrides. | Implemented; explicit visibility overrides and supported boolean component properties; native readback checks. |
| 3.07 | Preserve prototype-link overrides where supported. | Unsupported conversion handler; original prototype override retained and reported. |
| 3.08 | Preserve enabled and disabled Symbol override settings. | Partial; compatible override controls generate component properties. Figma cannot express every Sketch enable/disable control. |
| 3.09 | Preserve instance dimensions, resizing, and scaling behavior. | Partial; native instance dimensions and source constraints mapped; actual resizing/visual differences remain. |
| 3.10 | Preserve detached Symbols as editable Figma layers. | Editable Equivalent; detached source groups import as editable frames and children. |
| 3.11 | Preserve Symbol names, groups, and source identifiers. | Implemented; source names and IDs retained independently of Figma naming collisions. |
| 3.12 | Import local, shared, and embedded Sketch library components. | Implemented local and embedded/foreign component paths plus supplied libraries through the importer API. The panel has no library-mapping controls; published-library native acceptance remains open. |
| 3.13 | Resolve missing dependencies from supplied Sketch libraries. | Implemented dependency closure and supplied-library merging through the importer API; cycles and unresolved references produce findings. The panel has no dependency-resolution controls. |
| 3.14 | Map imported Symbols to existing Figma components and published libraries. | Implemented explicit ID/key mappings through the importer API; mapping controls are absent from the panel. Published access and incompatible mappings require native acceptance cases. |
| 3.15 | Preserve component relationships across repeated imports. | Implemented source/resource identity reuse; importer and binding tests check repeated imports without duplicate identities. Historical Test native reimports also reused IDs; current native upgrade acceptance remains open. |
| 3.16 | Optionally convert related Symbol states into Figma variants. | Not implemented; no variant states inferred from names. Requires explicit state/variant mapping controls. |
| 3.17 | Generate supported text, boolean, instance-swap, and variant properties. | Partial; TEXT, BOOLEAN and INSTANCE_SWAP properties generated from actual source controls. Variant properties not implemented. |
| 3.18 | Report overrides and external-library links without direct Figma equivalents. | Implemented; unknown overrides produce findings and retain original definitions. |

## 4. Styles, Colors, and Design Tokens

| ID | Requirement | Implementation and verification |
|---|---|---|
| 4.01 | Import local and library Text Styles. | Partial; original local/foreign Text Style definitions create native Text Styles, including all 19 in Test.sketch under the host double. Source overrides and library-native binding equality remain unresolved. |
| 4.02 | Import local and library Layer Styles. | Editable Equivalent; the three Test.sketch Layer Style definitions supply direct fill/stroke paints and original variable aliases. Compatible effects use native Effect Styles; there is no whole-Layer-Style target binding or generated Paint Style. |
| 4.03 | Import local and library Color Variables. | Implemented; local, foreign and supplied swatches have explicit source identities. Library-native coverage incomplete. |
| 4.04 | Import solid colors and gradient presets. | Implemented direct solid/gradient paints and preset definitions. Literal colors remain literal; no Paint Styles are created. Native gradient rendering is not certified. |
| 4.05 | Convert Sketch Color Variables into Figma color variables. | Implemented native COLOR variables for source swatches; color-variables.test.ts checks all 29 Test.sketch values, stale/recreated resource repair and rejected readback. Explicit variable mappings remain unchanged; current native acceptance is open. |
| 4.06 | Convert gradient presets into Figma paint styles. | Not implemented as Paint Styles under the current source-resource policy. Gradient presets convert to cached paint values; original definitions remain in metadata. No gradient Color/Paint Styles are generated. |
| 4.07 | Convert compatible Layer Styles into Figma paint and effect styles. | Partial under the current policy: Layer Style fills/borders use direct values and original color-variable aliases; compatible effects create native Effect Styles with the exact source name. No Paint Styles are generated. |
| 4.08 | Preserve style names, groups, definitions, and references. | Partial; exact source names and slashes are covered by Test.sketch and binding regressions, without importer-added folders or Color/Borders/Effects suffixes. Source renames reuse IDs; incompatible relationships remain explicit findings. |
| 4.09 | Preserve existing style bindings on layers and components. | Partial; matching ranges use original local Text Styles, and detached ranges are retried after overrides/tokens, including actual instance descendants. A binding is accepted only when its ID and exact typography survive readback. Incompatible overrides retain values and source relationship metadata, with a range finding; no additional Text Styles are generated. Native Bold/Italic preservation remains unresolved. |
| 4.10 | Preserve partially defined style properties. | Partial; skipColors honored; omitted alignment cannot become a partially bound Figma Text Style. |
| 4.11 | Preserve color-variable references in supported fills, strokes, and text. | Implemented explicit source aliases in compatible fills, strokes, text and gradient stops. Current binding tests cover these paths without inferring aliases from matching literal values. Historical native alias results are in VALIDATION.md; full current color/opacity fidelity remains unverified. |
| 4.12 | Preserve variable colors, transparency, and gradient stops. | Partial; source RGBA and stops are mapped, and a constant-gradient editable equivalent preserves independent paint opacity with a COLOR alias. Unit regressions cover values and bindings; current native alpha/interpolation acceptance remains open. |
| 4.13 | Import accompanying token files for spacing, sizing, radii, opacity, and other values. | Implemented the documented explicit token JSON schema for supplied values and bindings, including layout, radius, border and typography fields. It is not universal DTCG parsing; no numeric tokens are inferred from Test.sketch. |
| 4.14 | Map supplied token aliases and references to Figma variables. | Implemented explicit aliases with missing/type/cycle findings; aliases and node/range bindings tested. |
| 4.15 | Map supplied themes and modes to Figma variable collections and modes. | Implemented collection/mode conversion; plan-limit errors reported. Multi-mode visual acceptance remains. |
| 4.16 | Map imported resources to existing Figma variables and styles. | Implemented explicit local IDs and published keys through the importer API; missing/incompatible mappings produce findings. Mapping controls are absent from the panel. |
| 4.17 | Preserve original Sketch style definitions when Figma requires separate resources. | Implemented original source style definitions and IDs in chunked metadata alongside native Text/Effect Styles and direct paint equivalents. |
| 4.18 | Report unsupported style properties and broken token references. | Implemented exact property ledger plus unresolved-resource, token-alias and token-value findings. |

## 5. Text and Typography

| ID | Requirement | Implementation and verification |
|---|---|---|
| 5.01 | Preserve editable text layers and mixed formatting. | Implemented editable UTF-16 text ranges; current Test.sketch tests cover all 164 text layers and their source content. Mixed typography and actual native rendering are not fully accepted. |
| 5.02 | Preserve font families, weights, styles, and sizes. | Partial; typography.ts maps font descriptors, sizes and mixed ranges, with font loading and source-value reconciliation. Native glyph metrics and semantic Bold/Italic style retention remain unresolved. |
| 5.03 | Preserve text colors, gradients, and supported text effects. | Partial; typography.ts and appearance.ts map text paints, original color aliases, gradients and compatible effects. No text-color Paint Styles are generated; native appearance remains unverified. |
| 5.04 | Preserve variable-font axes and compatible OpenType features. | Partial; variable axes supported through FontName. OpenType setters absent in installed API; original features retained. |
| 5.05 | Preserve kerning, letter spacing, line height, and baseline positioning. | Partial; compatible letter spacing and line height are mapped. Unsupported baseline/kerning semantics remain source metadata and findings; exact line height overrides can prevent retaining the original Text Style. |
| 5.06 | Preserve paragraph alignment, spacing, indentation, and tabs. | Partial; compatible alignment, spacing and indent mapped. Arbitrary tab stops/head-tail indentation unsupported. |
| 5.07 | Preserve bullets, numbered lists, and list formatting. | Partial; literal bullet characters and tabs are retained, but custom tab stops and hanging indents are not converted. Limitations are in the complete stored audit; the resource-focused screen is not a separate typography-fidelity report. |
| 5.08 | Preserve text decorations, capitalization, and case transformations. | Partial; compatible native decoration and case values are mapped per range. Unsupported rich-text behavior and style-detaching overrides remain explicit findings; current native acceptance is open. |
| 5.09 | Preserve horizontal and vertical text alignment. | Implemented compatible text alignment; per-run vertical alignment cannot be represented independently. |
| 5.10 | Preserve fixed-width, fixed-height, auto-height, and content-based sizing. | Partial; fixed/auto text sizing and modern Stack sizing mapped. Host glyph metrics alter some dimensions. |
| 5.11 | Preserve wrapping, line breaks, text overflow, and text-box dimensions. | Partial; source characters and explicit breaks are retained, with native sizing/wrapping behavior. Glyph metrics, tab stops and hanging indents can change wrap and height; strict size differences remain in the full audit, outside the panel. |
| 5.12 | Convert text on paths using Figma-compatible text-path functionality. | Partial; beta API has a writable surface; conversion requires an explicit source path sidecar. Direct archive path resolution incomplete. |
| 5.13 | Preserve original text-path geometry metadata. | Implemented source geometry retention; no implicit text outlining. |
| 5.14 | Preserve superscript, subscript, and rich-text properties where supported. | Partial; rich text retained, arbitrary baseline shift/super-subscript not writable through compatible setters. |
| 5.15 | Detect missing fonts and provide replacement mapping. | Partial; scoped available-font detection blocks missing fonts before writes. Replacement mappings remain in the importer API; mapping UI removed at the user’s request. |
| 5.16 | Validate glyph metrics, line breaks, and text-rendering fidelity. | Not fully implemented; the standalone comparison script checks supplied frame renders. No current per-glyph or source line-break baseline suite certifies typography fidelity. |
| 5.17 | Report unsupported typography features and editability differences. | Partial; the source-property ledger and per-range Text Style findings retain unsupported typography and editability differences. No independent complete typography-rendering audit exists. Style-binding issues appear under Text styles; other limitations remain in the full audit. |

## 6. Layout and Responsive Behavior

| ID | Requirement | Implementation and verification |
|---|---|---|
| 6.01 | Convert Sketch Stacks into Figma Auto Layout. | Implemented serialized MSImmutableFlexGroupLayout conversion in serialized-layout.ts and layout.ts. Current Test.sketch tests check all 181 Stacks for flow, padding, gaps and sizing under the host double; native responsive fidelity remains open. |
| 6.02 | Translate legacy Smart Layout into compatible Figma behavior. | Partial; legacy Smart Layout maps to measured Auto Layout equivalents. Prior public-fixture exercises are historical, not current regression inputs; exact resize semantics remain unverified. |
| 6.03 | Preserve horizontal, vertical, and wrapping layouts. | Implemented native horizontal/vertical/wrap mappings; multi-line wrap baselines still required. |
| 6.04 | Preserve primary-axis and cross-axis alignment. | Partial; `serialized-layout.ts` and `layout.ts`. Test has 181 Stacks; sizing cycles and unsupported distributions are reported. |
| 6.05 | Preserve Space Between, Space Around, and Space Evenly distributions. | Implemented compatible Between/Around/Evenly mappings from source enums and supplied sidecars; bindings.test.ts checks horizontal/vertical initial and repeat positions under the host double. Wrapped distribution and current native acceptance remain limited. |
| 6.06 | Preserve independent child alignment. | Partial; compatible layoutAlign values used; independent cross-axis behavior needs native resize cases. |
| 6.07 | Preserve padding, gaps, and negative spacing. | Implemented serialized four-side padding and gaps; current Test.sketch Stack readbacks cover these fields. Negative spacing and rendered layout stress cases still need native acceptance. |
| 6.08 | Preserve fixed, content-based, and fill sizing. | Partial; fixed/Fit/Fill mapped. Fit-parent/Fill-child cycles retain fixed source size with explicit findings. |
| 6.09 | Translate relative-percentage sizing using the closest compatible behavior. | Partial; relative dimensions retained as fixed source dimensions with original percentage metadata. |
| 6.10 | Preserve minimum and maximum dimensions. | Implemented direct serialized minSize/maxSize per-axis limits, including removal of zero limits on reimport; supplied sidecars also supported. Native acceptance remains open. |
| 6.11 | Preserve resizing constraints and pinned edges. | Implemented legacy bitmask and explicit modern pinned-edge conversion; native responsive verification incomplete. |
| 6.12 | Preserve nested Stacks and layout relationships. | Partial; nested Stacks and inherited component layouts are retained and checked. Genuine height differences remain in the complete audit; geometry is excluded from the resource-focused screen. |
| 6.13 | Preserve layers excluded from Stack layout. | Implemented native absolute child positioning for ignoreLayout. |
| 6.14 | Preserve hidden-child spacing behavior where reproducible. | Partial; ordinary hidden-child collapse mapped. Reserved hidden spacing has no implemented spacer equivalent. |
| 6.15 | Preserve overlapping elements and stacking order. | Implemented first-on-top Stack order and negative spacing; overlapping mask/layout cases need further native verification. |
| 6.16 | Preserve border-inclusive layout calculations where reproducible. | Partial; serialized border-inclusive layout maps to the native border-box flag. Sketch protruding-child-border semantics require independent native comparison; no exact-equivalence claim. |
| 6.17 | Preserve proportional scaling in Sketch Graphics. | Partial; editable Graphic frames and constraints; exact proportional responsive behavior not yet certified. |
| 6.18 | Preserve absolute positioning within responsive containers. | Implemented absolute positioning and original transforms inside Auto Layout; source Fill on absolute children reported partial. |
| 6.19 | Validate layouts across multiple frame dimensions. | Not completed; current tests do not establish source/target equivalence across multiple frame sizes. Independent Sketch resize baselines and native responsive comparisons remain required. |
| 6.20 | Report Sketch-specific layout behaviors without native Figma equivalents. | Implemented explicit findings for sizing cycles, relative sizing, distributions and hidden spacing. |

## 7. Shapes and Vector Geometry

| ID | Requirement | Implementation and verification |
|---|---|---|
| 7.01 | Preserve editable rectangles, ellipses, polygons, stars, triangles, lines, and arrows. | Partial; native rectangle/ellipse, editable polygon/star/triangle paths and line vectors. Live parametric controls not all retained. |
| 7.02 | Preserve editable Bézier paths and vector control points. | Implemented vector networks and control points; native visual/geometry audits remain necessary. |
| 7.03 | Preserve open and closed vector paths. | Partial; `geometry.ts` and native boolean operands. Vector bounds and advanced corner semantics still need complete verification. |
| 7.04 | Preserve compound paths and winding rules. | Editable Equivalent; compound-paths.ts builds one vector region for None contours with source Evenodd/Nonzero winding. All 73 Test.sketch compounds are checked (55 Evenodd, 18 Nonzero). Original contour IDs/layers remain hidden and editable; their edits do not update the rendered vector live. Open-path border closure and unresolved native winding remain explicit limitations. |
| 7.05 | Convert Union, Subtract, Intersect, and Difference boolean operations. | Implemented shared Union/Subtract/Intersect/Difference sequencing in booleans.ts, preserving source operand order and subtraction base. None is compound geometry, not Union. Frame/Symbol operands can use disposable resolved copies while originals remain editable. Global boolean regressions cover sequencing, transforms, reimport and rollback; current native Figma rendering remains unverified. |
| 7.06 | Preserve individual corner radii. | Implemented four native radii; actual Test modern corners tested. |
| 7.07 | Preserve rounded, smooth, angled, inside-square, inside-arc, and automatic corner styles through native or vector-equivalent conversion. | Partial; round/smoothing mappings; angled, inside-square, inside-arc and automatic editable expansion incomplete. |
| 7.08 | Preserve compatible corner smoothing and curvature. | Partial; native smoothing surface used, exact Sketch curvature not certified. |
| 7.09 | Preserve vector transformations, rotations, and flipping. | Partial; `geometry.ts` and native boolean operands. Vector bounds and advanced corner semantics still need complete verification. |
| 7.10 | Preserve connector paths, endpoints, arrowheads, and geometry. | Partial; vector line geometry and compatible caps; connector-specific semantics and arrowhead coverage incomplete. |
| 7.11 | Preserve vector clipping and masking relationships. | Partial; `geometry.ts` and native boolean operands. Vector bounds and advanced corner semantics still need complete verification. |
| 7.12 | Retain source corner parameters when conversion removes live editing controls. | Implemented; original corner parameters retained in source metadata regardless of target control availability. |

## 8. Fills, Borders, Masks, and Effects

| ID | Requirement | Implementation and verification |
|---|---|---|
| 8.01 | Preserve multiple fills, ordering, visibility, and opacity. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.02 | Preserve solid, gradient, and image fills. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.03 | Preserve linear, radial, and angular gradients. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.04 | Preserve gradient stops, positions, angles, colors, and transparency. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.05 | Reproduce Sketch gradient interpolation using compatible native or sampled gradients. | Partial; native gradients retained. No verified sampled interpolation fallback yet. |
| 8.06 | Preserve multiple borders and stroke ordering. | Partial; multiple paints preserved, Figma stroke geometry shares width/alignment. |
| 8.07 | Preserve individual-side border widths. | Not fully implemented; compatible native setter exists, direct source per-side schema coverage incomplete. |
| 8.08 | Preserve inside, center, and outside stroke alignment. | Implemented compatible native alignment; differing per-border alignments explicitly partial. |
| 8.09 | Preserve stroke dashes, caps, joins, and miter settings. | Implemented caps/joins/dashes/miter setters; native path rendering stress tests remain. |
| 8.10 | Preserve layer opacity, paint opacity, and supported blend modes. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.11 | Preserve multiple inner and outer shadows. | Implemented current combined shadows with isInnerShadow and legacy separate arrays. |
| 8.12 | Preserve shadow blur, spread, color, offset, and opacity. | Implemented native parameters and color aliases; blur-kernel pixel equality not claimed. |
| 8.13 | Preserve Layer Blur and Background Blur. | Implemented legacy/current layer and background blur arrays; native visual equivalence still partial. |
| 8.14 | Convert compatible Glass effects into Figma Glass effects. | Partial; supplied Glass sidecar maps writable target effect; direct current Sketch Glass serialization is unverified. |
| 8.15 | Reproduce Fade, Motion Blur, Zoom Blur, and other unsupported effects using explicit fallbacks. | Partial; Fade now uses editable alpha masks. Motion/Zoom Blur have no implemented visual fallback; retained and reported. |
| 8.16 | Preserve individual effect visibility and stacking order. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.17 | Reproduce group and Symbol tint appearances. | Partial; direct tint/color overrides supported; inherited group/Symbol tint rendering incomplete. |
| 8.18 | Preserve alpha masks, outline masks, and clipping masks. | Editable Equivalent; explicit bounded alpha/vector masks, visible outline regions, source metadata retained. |
| 8.19 | Preserve nested masks and group clipping relationships. | Partial; nested mask wrappers and resize constraints implemented; repeated partial-import mask-chain recovery needs more native cases. |
| 8.20 | Preserve image blending and transparency behavior. | Partial; `appearance.ts`, `opacity-masks.ts`, bounded mask chains. Per-property outcomes and explicit approximations are reported. |
| 8.21 | Report appearance properties requiring approximation, vector expansion, or rasterization. | Implemented leaf ledger and findings; destructive flattening/rasterization never automatic. |

## 9. Images, Assets, and Export Settings

| ID | Requirement | Implementation and verification |
|---|---|---|
| 9.01 | Import embedded images at their original resolution. | Editable Equivalent for PNG/JPEG rasters exceeding the native 4096px per-axis image limit: original-resolution tiles reconstruct the source crop/mask. Test.sketch preparation and images.test.ts cover asset identity, tile coverage, repeat import and cleanup with mocked decoding/host behavior; native pixels remain unverified. |
| 9.02 | Preserve original image assets, aspect ratios, and transparency. | Partial; supported image identity, aspect and alpha are retained. Oversized original bytes are not sent to the native payload; decoded tiles can change color-profile representation and require visual acceptance. Keep the original local Sketch archive; no archive-download UI exists. |
| 9.03 | Preserve image-fill modes, cropping, positioning, and scaling. | Partial; FILL/FIT/TILE/CROP mapped, but arbitrary source crops and adjustments need complete verification. |
| 9.04 | Preserve tiling and repeat settings where supported. | Implemented compatible native TILE scale; unusual repeat transforms reported as unsupported leaves. |
| 9.05 | Preserve compatible image adjustments and filters. | Partial; compatible image filter path is limited; full source color-controls translation incomplete. |
| 9.06 | Preserve image overrides inside component instances. | Partial; normal image overrides implemented; oversized override images require further linked-instance support. |
| 9.07 | Convert supported SVG, PDF, and other graphic assets. | Partial; SVG has editable API surface, general asset ingestion incomplete. Direct PDF native import unavailable; PDF metadata retained. |
| 9.08 | Preserve vector editability whenever possible. | Implemented native vector-first policy; no automatic outlining or design-layer rasterization. |
| 9.09 | Detect and deduplicate repeated image assets. | Implemented image hash reuse and source-asset cache; generated tiles reused across references. |
| 9.10 | Convert Sketch slices into Figma exportable resources. | Implemented native Slice nodes and exportSettings. |
| 9.11 | Preserve export scales, dimensions, prefixes, suffixes, and naming conventions. | Partial; scales/absolute dimensions/suffixes mapped. Prefixes and unavailable naming behavior retained. |
| 9.12 | Map compatible PNG, JPG, SVG, and PDF export settings. | Implemented compatible PNG/JPG/SVG/PDF export settings. Prior public export-fixture exercises are historical; the removed fixtures folder is not current coverage. |
| 9.13 | Retain unsupported export-format settings as source metadata. | Implemented original export options retained, unsupported formats explicitly reported. |
| 9.14 | Report image-quality, color, resolution, and export-format differences. | Partial; oversized-image, decoded-profile and unsupported export settings produce findings in the full audit. The standalone script generates metrics from supplied renders; obsolete sample artifacts were removed, with historical summaries retained in VALIDATION.md. |

## 10. Prototyping and Interactions

| ID | Requirement | Implementation and verification |
|---|---|---|
| 10.01 | Convert Sketch navigation links and hotspots. | Partial; `prototypes.ts` implements click navigation, back/URL actions, flows and optional cross-page clones. Advanced behavior is incomplete. |
| 10.02 | Preserve prototype flow starting points and names. | Partial; `prototypes.ts` implements click navigation, back/URL actions, flows and optional cross-page clones. Advanced behavior is incomplete. |
| 10.03 | Preserve supported click, hover, press, and toggle triggers. | Partial; click native. Hover/press/toggle archive handlers incomplete. |
| 10.04 | Preserve navigation destinations and back-navigation behavior. | Partial; `prototypes.ts` implements click navigation, back/URL actions, flows and optional cross-page clones. Advanced behavior is incomplete. |
| 10.05 | Preserve supported prototype interactions within components. | Partial; `prototypes.ts` implements click navigation, back/URL actions, flows and optional cross-page clones. Advanced behavior is incomplete. |
| 10.06 | Preserve compatible Symbol prototype-link overrides. | Unsupported handler; source override retained and reported. |
| 10.07 | Convert overlay interactions and positioning where supported. | Partial API ceiling; overlay source mapping incomplete. |
| 10.08 | Preserve compatible overlay dismissal and backdrop behavior. | Unsupported writable settings in relevant installed surfaces; source metadata retained. |
| 10.09 | Preserve supported transitions, timing, easing, and directions. | Partial directional transition mapping; duration defaults/easing approximations reported. |
| 10.10 | Map compatible Smart Animate transitions. | Not implemented from direct archive; compatible target API exists. |
| 10.11 | Preserve supported show, hide, and toggle interactions. | Not implemented generically; no direct visibility action in Figma. Explicit variable/variant reconstruction would require source semantics. |
| 10.12 | Preserve vertical and horizontal scrolling regions. | Partial; basic overflow mappings. Current prototypeScrolling serialization coverage incomplete. |
| 10.13 | Preserve fixed elements and compatible scroll-position behavior. | Partial; fixed-child ordering and source scroll-position behavior not fully reconstructed. |
| 10.14 | Convert external navigation links where supported. | Implemented URL action for supported external links. |
| 10.15 | Generate a compatible single-page prototype arrangement for cross-page Sketch navigation when needed. | Partial; generated clone arrangement exists; repeat generation/local conflict behavior needs repair before release. |
| 10.16 | Preserve original page structure independently of generated prototype arrangements. | Implemented separate arrangement page; original pages remain independent. |
| 10.17 | Report read-only, unsupported, or partially reconstructed prototype properties. | Implemented per-property Unsupported/Partial reporting; no writable surface assumed from Figma UI. |

## 11. Source Metadata and Synchronization

| ID | Requirement | Implementation and verification |
|---|---|---|
| 11.01 | Preserve original Sketch document, page, layer, and Symbol identifiers. | Implemented stable document/page/layer/Symbol identifiers in chunked plugin metadata. |
| 11.02 | Preserve source library and resource references. | Implemented original resource/library references retained alongside explicit imported mappings. |
| 11.03 | Preserve supported layer-level plugin metadata. | Implemented raw source userInfo/plugin metadata retention; foreign plugin behavior is not executed. |
| 11.04 | Preserve original Sketch properties without direct Figma equivalents. | Implemented storage mechanism; `storage.ts` and importer fingerprints/journal. Recovery is best effort, with explicit errors; not a guarantee of atomicity. |
| 11.05 | Preserve supported data-populated text and image content. | Implemented rendered text/image content where directly serialized; external live data bindings unsupported. |
| 11.06 | Retain supplied external data-source metadata. | Implemented raw supplied external metadata retention, without pretending to recreate the external service. |
| 11.07 | Store source-to-Figma node mappings. | Implemented persistent source-node mapping index; repeat-import regressions. |
| 11.08 | Track resource dependencies and original property values. | Implemented storage mechanism; `storage.ts` and importer fingerprints/journal. Recovery is best effort, with explicit errors; not a guarantee of atomicity. |
| 11.09 | Detect source changes across repeated imports. | Implemented source/target fingerprints and change detection; actual source changes tested. |
| 11.10 | Update imported layers, components, styles, and variables without unnecessary duplication. | Partial; converter/configuration fingerprints repair older imports in place. Current host-double regressions check stable node/resource IDs, nested override targets and legacy generated-resource cleanup. Generated prototype-page reimport remains a gap; current native upgrades are not certified. |
| 11.11 | Preserve existing Figma modifications through configurable conflict resolution. | Implemented preserve-local / replace-imported policies and resource conflict tests; inherited resource effects require broader acceptance cases. |
| 11.12 | Maintain source-property snapshots for future reimport and recovery. | Implemented snapshots/journal; mixed style and token recovery regressions. Crash/native recovery coverage incomplete. |

## 12. Import Controls and Management

| ID | Requirement | Implementation and verification |
|---|---|---|
| 12.01 | Preview files, pages, layers, components, styles, tokens, and dependencies. | Removed from the panel at the user’s request. Core preflight inspection remains available to code. |
| 12.02 | Selectively import pages, frames, components, styles, variables, or everything. | Partial; whole-file panel import with category switches for unused resources. Required resources always included. Selective page/layer and resources-only scope remain importer API options; UI removed at the user’s request. |
| 12.03 | Choose destination pages and resource organization. | Removed from the panel at the user’s request. Panel preserves source pages; destination mapping remains an importer API option. |
| 12.04 | Batch import multiple Sketch files. | Implemented minimal batch queue, worker parsing, source-identity deduplication and sequential imports. UI regressions cover nested-host messages, stale request IDs, newer archive replacement and stopping a cancelled batch; current native interaction acceptance remains open. |
| 12.05 | Detect missing fonts, libraries, components, and assets before import. | Partial; scoped font detection before writes and archive checks. Core dependency preflight remains available; dependency preview/mapping UI removed at the user’s request. |
| 12.06 | Provide resource replacement and mapping controls. | Removed from the panel at the user’s request. Explicit replacements/mappings remain importer API options. |
| 12.07 | Detect duplicate components, styles, variables, and assets. | Partial; stable source IDs and hashes deduplicate. No unsafe same-name or same-literal inference. |
| 12.08 | Resolve naming and resource conflicts. | Partial; exact source names and ID reuse take precedence over automatic renaming. Explicit mappings and conflict policies remain importer API options; arbitrary interactive conflict resolution is absent. |
| 12.09 | Support incremental reimport. | Partial; stable identities are reused, newer queued archives replace older revisions, and local edits follow the conflict policy. Legacy converter fingerprint migration and resource cleanup have tests; current native upgrade acceptance remains open. |
| 12.10 | Support import progress, cancellation, and failure recovery. | Partial; per-file indeterminate Reading/Preparing bars, Sketch-to-Figma transfer animation, layer progress, cancellation and journal recovery are implemented. Preparation status clears on success/error; stale messages are ignored. Image preparation cannot yet be actively cancelled, and native/process-crash recovery remains unverified. |
| 12.11 | Optimize processing of large files and complex documents. | Partial; bounded ZIP extraction, worker parsing and oversized-image preparation are exercised with a separately supplied Test.sketch. Native large-raster memory limits, import stall diagnosis and performance budgets are not established. |
| 12.12 | Support partial import recovery and safe cleanup. | Partial; owned cleanup is deferred until commit and errors reported. Native interruption matrix incomplete. |
| 12.13 | Generate import summaries and detailed conversion reports. | Implemented a compact five-category resource report with consistent issue counts, layer navigation, accordion Details and lazy saved-audit loading after reopening. Complete per-file audits are compressed in document metadata; storage errors are reported. Geometry is excluded from the panel and all displayed totals; report-export controls remain absent. |

## 13. Conversion Fidelity and Quality Assurance

| ID | Requirement | Implementation and verification |
|---|---|---|
| 13.01 | Detect and classify every supported Sketch source property. | Implemented every leaf detected, including unknown scalars/empty arrays; exact-pointer ledger regressions. Detection is not support. |
| 13.02 | Maintain an explicit Sketch-to-Figma property compatibility matrix. | Implemented COMPATIBILITY.md and this unchanged 203-requirement specification. API review targets installed @figma/plugin-typings 1.141.0; this is not a fresh audit of every current Figma API surface. |
| 13.03 | Prefer native Figma objects and properties. | Implemented native-first conversion paths for supported nodes, resources, layouts and prototypes, with explicit editable equivalents. Passing typechecks or host-double tests does not establish complete native conversion fidelity. |
| 13.04 | Preserve native editability whenever a compatible mapping exists. | Partial; native editable paths implemented where known; writable but unimplemented cases remain visible release gaps. |
| 13.05 | Use editable equivalents when native mappings are unavailable. | Implemented fixed-bounds groups, booleans, oversized-image tiles and Fade masks; equivalents are explicitly classified. |
| 13.06 | Use visual equivalents when editable conversion is impossible. | Partial; no implicit destructive fallback. Unsupported visual content remains reported pending an approved fallback. |
| 13.07 | Require approval before destructive flattening or rasterization. | Implemented source-preservation policy: destructive flattening/rasterization of imported originals has no automatic path. Boolean resolution may flatten disposable copies into editable geometry while retaining original subtrees and reporting lost live relationships. Original-raster tiling does not flatten design layers. |
| 13.08 | Preserve original source metadata for non-native conversions. | Implemented chunked original source definitions, IDs and complete per-file audit storage. Keep the original local archive; archive-download UI removed at the user’s request. |
| 13.09 | Classify results as Native, Editable Equivalent, Visual Equivalent, Partial, or Unsupported. | Implemented all five classifications on exact leaf properties; failed setters roll back claims. |
| 13.10 | Validate page, layer, component, instance, style, and variable counts. | Partial; source-node counts and resources checked; complete per-type count equality matrix needs extension. |
| 13.11 | Validate layer positions, dimensions, rotations, and hierarchy. | Partial; strict geometry-aware frame/path bounds, Bezier extrema, wrapper/origin compensation and orientation checks remain in the full audit, excluded from the panel/counts. Current unit and Test.sketch regressions remain; deleted historical native readback captures are not current regression coverage. Native acceptance remains open. |
| 13.12 | Validate component relationships, overrides, and resource bindings. | Partial; native component links, overrides and style/variable aliases checked; inherited component layout properties and aliases now read back. Exact incompatible source style overrides remain Partial. |
| 13.13 | Validate typography, colors, gradients, effects, and image appearance. | Partial; current tests/readbacks check text content, selected property values and resource aliases. Supplied-render pixel comparisons are separate tooling; historical samples do not certify current typography, gradients, effects or image appearance. |
| 13.14 | Validate responsive layouts at multiple frame sizes. | Not completed; multi-size source resize baselines and responsive render comparison required. |
| 13.15 | Validate prototype links, destinations, and supported interactions. | Partial; basic reaction/destination checks; advanced prototype behavior cannot be certified. |
| 13.16 | Generate visual comparisons and pixel-difference reports. | Implemented standalone PNG metrics/heatmap generation in scripts/compare-renders.mjs, without resampling. No reference-render or export controls exist in the panel. Generate comparison outputs outside the repo; historical sample artifacts are not current acceptance evidence. |
| 13.17 | Detect missing elements, broken references, and unexpected flattening. | Partial; missing source nodes/references and unexpected target types checked. Complete visual missing-content detection remains. |
| 13.18 | Detect unsupported or read-only Figma Plugin API properties. | Partial; typechecking uses installed @figma/plugin-typings 1.141.0 and rejected setters produce findings. Unknown source fields remain Unsupported; typechecks do not prove every current API behavior or read-only limitation. |
| 13.19 | Report visual, structural, behavioral, and editability differences. | Partial; the complete stored audit retains property findings and structural/geometry checks. The visible report covers Color variables, Layer styles, Text styles, Symbols and Tokens plus fatal errors; unrelated findings remain in the full audit. Visual/behavioral acceptance remains incomplete. |
| 13.20 | Prevent silent content loss and unreported conversion failures. | Partial release gate; every property reported, but substantial conversion fidelity gaps remain. Do not label production-ready. |
| 13.21 | Produce a final per-file conversion audit. | Implemented a complete compressed per-file audit in document plugin data, accessible through readReport; storage/corruption failures are reported. The panel presents a resource-focused subset. A Markdown formatter remains a code helper, not a report-export UI. |
