# Sketch → Figma property compatibility matrix

Audited against @figma/plugin-typings 1.141.0 on 2026-10-08. This is a capability/design matrix; runtime evidence and implementation status are recorded separately. N = Native; E = Editable Equivalent; V = Visual Equivalent; P = Partial; U = Unsupported. Metadata is always retained independently.

| Section | Sketch property / feature | Figma writable surface | Ceiling / caveat |
|---|---|---|---|
| 1 | ZIP JSON documents, pages, layer IDs | createPage, plugin data | N; pre-43 binary archives U |
| 1 | Page names/order/backgrounds | name, root.insertChild, backgrounds | N; one solid canvas paint |
| 1 | Artboards/frames | createFrame, clipsContent | N |
| 1 | Groups | fixed-bounds FrameNode | E; source groups use editable frames to preserve explicit bounds |
| 1 | Geometry/rotation/flips | resize, relativeTransform | N; compare geometry-relative origins and affine orientation; native vectors rebase bounds |
| 1 | Visibility/lock/opacity | visible, locked, opacity | N |
| 1 | Templates/user data | plugin data | U semantic template behavior |
| 1 | sRGB/Display P3/unmanaged | readonly documentColorProfile, RGB paint | P; explicit profile conversion/gamut clipping |
| 2 | Grids | layoutGrids | N for square, stretch, center, left, right |
| 2 | Rulers/guides | guides | N offsets; UI visibility U |
| 3 | Symbol source/instance/nesting | createComponent, createInstance | N; dependency ordering required |
| 3 | Text/image/visibility overrides | characters, fills, visible | N with source path resolution |
| 3 | Nested symbol swap | swapComponent | N if source component resolved |
| 3 | Style/tint overrides | style binding/fills | P; inherited tint semantics differ |
| 3 | Enabled override controls | addComponentProperty, componentPropertyReferences | P; not all Sketch controls map |
| 3 | Linked library replacements | importComponentByKeyAsync | N with explicit keys/access |
| 3 | Variants | combineAsVariants | P; cannot infer state semantics safely |
| 3 | Instance scaling | resize/rescale | P; responsive vs proportional resize differs |
| 4 | Text styles | createTextStyle, setRangeTextStyleIdAsync | N compatible original bindings; incompatible overrides retain exact source typography and are reported as unbound |
| 4 | Layer styles | PaintStyle + EffectStyle + stroke style | E split resources |
| 4 | Swatches | createVariable COLOR, setBoundVariableForPaint | N solid paints/text ranges; independent bound-color paint opacity E constant two-stop gradient, without added variables |
| 4 | Gradient presets | createPaintStyle | N editable; interpolation validation needed |
| 4 | Tokens/aliases/themes | variable collections/modes/aliases | N for compatible types; plan limits/errors reported |
| 4 | Existing styles/variables | get/import style and variable APIs | N with explicit mapping |
| 5 | UTF-16 rich text ranges | setRange* methods | N; validate bounds |
| 5 | Font family/style/size | loadFontAsync, fontName/fontSize | N; replacement P |
| 5 | Variable font axes | FontName.variationSettings | N supported tags; numeric Sketch tags decoded |
| 5 | Kerning/line height/spacing | letterSpacing, lineHeight, paragraphSpacing | P; pair kerning and baseline differ |
| 5 | Alignment/indent/lists | textAlign*, paragraphIndent, setRangeListOptions | N compatible values |
| 5 | Tabs/precise baselines | no arbitrary tab stops/baseline shift | U; retain rich text metadata |
| 5 | Decoration/case | textDecoration, textCase | N; simultaneous underline + strike P |
| 5 | Sizing/wrapping/overflow | textAutoResize, textTruncation | P; metrics need render checks |
| 5 | Text on path | createTextPath(VectorNode, segment, position) | N beta; source path must resolve |
| 5 | OpenType features | openTypeFeatures/getRangeOpenTypeFeatures readonly | U writes in installed API |
| 5 | Super/subscript | supported OpenType or source metadata | U arbitrary baseline positioning |
| 6 | Stacks | layoutMode/wrap/spacing/padding/sizing | P; all 181 Test Stacks exercised, with Fit/Fill cycle findings and native geometry failures |
| 6 | Legacy Smart Layout | groupLayout → auto layout | P; different resizing semantics |
| 6 | Space between | primaryAxisAlignItems SPACE_BETWEEN | N |
| 6 | Space around/evenly | primaryAxisAlignItems SPACE_AROUND / SPACE_EVENLY | N; numeric Sketch 4/5 and explicit sidecar Around/Evenly; horizontal/vertical regressions and prior native readback verify positions |
| 6 | Per-child alignment | layoutAlign, layoutGrow | P limited independent alignment |
| 6 | Min/max/absolute child | min/maxWidth/Height, layoutPositioning | N supported types; serialized NSSize limits map per axis, zero removes limit |
| 6 | Pinned edges | constraints | N supported combinations |
| 6 | Percentage sizing/hidden spacing | no equivalent percentage model | P/U; report |
| 7 | Rect/oval/polygon/star | native primitives | N when representable |
| 7 | Bézier/open/closed paths | setVectorNetworkAsync | N/E; compound fill closure is explicit; open-path compound border closure is P and reported |
| 7 | Compound contours (None = -1) | one native VectorRegion, multiple loops | E; Evenodd and Nonzero preserved; original layers/IDs retained in hidden container; retained operand edits do not automatically update the rendered vector |
| 7 | Boolean operations | union/subtract/intersect/exclude | N/E; source order, subtraction base, parity clipping, first-operand semantics and None distinguished; unpainted operands receive internal operative fills without resources; Frame/Symbol/nested shapes use editable copies with retained originals; mixed nonzero compounds may resolve disposable copies; complex native winding representations can be rejected explicitly |
| 7 | Corner radii/smoothing | cornerRadius/four radii/cornerSmoothing | N for compatible corners |
| 7 | Other corner shapes | editable vector geometry | E only with explicit geometry; else U |
| 7 | Arrows/connectors | vector/line stroke caps | E Design vectors; FigJam connectors not same type |
| 8 | Multi-fills | fills Paint[] | N; Sketch paint ordering verified separately |
| 8 | Linear/radial/angular gradients | gradientTransform/stops | N/P aspect/interpolation |
| 8 | Multiple border widths/alignments | strokes share geometry | P; multiple strokes share width/alignment |
| 8 | Per-side border width | individualStrokeWeights | N compatible rectangle/frame types |
| 8 | Caps/joins/dashes/miter | strokeCap/Join, dashPattern, strokeMiterLimit | N |
| 8 | Blend modes | BlendMode | N common modes; plus-darker U |
| 8 | Shadows/spread/blur | effects | N compatible effects/order |
| 8 | Glass | GlassEffect | N target API; source schema mapping unverified |
| 8 | Fade / progressive opacity | gradient alpha mask + editable wrapper | E; source bitmap remains editable; native source-render comparisons required |
| 8 | Motion/zoom blur | no equivalent effect | U; no implicit rasterization |
| 8 | Mask chains | isMask, maskType, bounded wrappers | E; visible outline-mask artwork needs a separate native paint layer. Clip-content frames terminate mask chains |
| 8 | Group/Symbol tint | no exact inherited tint primitive | P/U |
| 9 | Embedded images/dedup | createImage hash | N up to API limits; oversized rasters E original-resolution image tiles with per-tile native cropping |
| 9 | Image modes/crop/tile | scaleMode/imageTransform/scalingFactor | N/P crops/adjustments differ |
| 9 | SVG | createNodeFromSvg | E editable; verify unsupported SVG features |
| 9 | PDF import | no direct native PDF import API | U; PDF export available |
| 9 | Slices/export formats/scales | createSlice, exportSettings | N PNG/JPG/SVG/PDF; WEBP/BMP are not writable exportSettings in installed typings |
| 9 | Export prefixes/naming | suffix only | P prefix source retained |
| 10 | Links/hotspots/triggers | setReactionsAsync | N supported trigger/action types |
| 10 | Flows | flowStartingPoints | N; prototypeStartNode readonly |
| 10 | Overlay behavior | reaction NAVIGATE OVERLAY | P overlayPositionType/background readonly |
| 10 | Transitions/easing | Reaction transition | N compatible enums; inferred timings P |
| 10 | Show/hide/toggle | SET_VARIABLE or component variant actions | P; no generic visibility action |
| 10 | Scrolling/fixed children | overflowDirection, numberOfFixedChildren | P fixed layers must be topmost |
| 10 | Cross-page navigation | generated single-page clones | E; independent source pages preserved |
| 11 | Source metadata/mappings/snapshots | plugin data | N storage; external data binding U |
| 11 | Incremental sync | source/target fingerprints + journal | E; conflict policy required |
| 12 | Preflight/batch/select/cancel/recovery | plugin UI + native mutations | E; cleanup must be verified |
| 13 | Structural/pixel audits | read API/exportAsync + reference renders | E; no source render without Sketch/baseline |

## Non-negotiable reporting
A current Figma UI feature is never treated as writable without its Plugin API setter. Compile failures, host rejections, unresolved references, sampled colors, missing glyphs, unsupported metadata, inferred behavior, and skipped scope are visible outcomes. Pixel QA without a supplied Sketch render is `not-run`, never `passed`.

## Native behavior verified beyond typings

- A Figma frame with Clip content stops an outer mask. Image tiles use native paint crops with clipping disabled to preserve the surrounding mask. See [Figma masking boundaries](https://help.figma.com/hc/en-us/articles/360040450253-Masks).
- Figma COLOR bindings own solid-paint opacity. The alpha probe demonstrated that assigning an additional paint opacity before binding silently loses that multiplier. The importer uses a constant gradient with bound stops for this case, classified Editable Equivalent. It does not add composed color variables absent from the source.
- Source explicit font/range overrides can detach a Figma Text Style. Compatible ranges stay bound; conflicting ranges preserve source values and are reported Partial. An unchanged named font is not reassigned merely because native readback includes default variation axes.

## Binding and reimport corrections (2026-10-08)

Only explicit, live source Text Style references create bindings. Matching ranges use the original style. Overrides are reapplied only when readback confirms that the host retains the original style ID and exact values. Incompatible overrides remain literal and are reported; the user explicitly prioritizes exact Sketch typography. No additional Text Styles are created. Final reconciliation runs after token bindings and in actual nested instances. Literal text and historic detached-style metadata do not create styles. Revision-9 native acceptance remains open.

Source snapshots include a converter/configuration hash, so unchanged files imported by an older converter can be repaired in place. Existing Figma edits remain subject to the selected conflict policy. Current importer regressions check existing node/resource IDs across repair. Figma's `removeOverrides()` resets instance-root plugin metadata to the main component's values; importer-owned source identity is stamped again after the reset so nested Sketch override paths remain addressable.

Figma's current [Auto Layout distribution API](https://developers.figma.com/docs/plugins/updates/2026/08/31/version-1-update-137/) exposes Space Around and Space Evenly. The former unsupported assumption was incorrect and is removed. [Text Style override information](https://developers.figma.com/docs/plugins/api/TextStyleOverrides/) is exposed through text-segment readback; UI semantic overrides are not assumed writable through an undocumented API.

## Stack details checked in the current converter

Serialized `stackingOrder` maps both known Sketch values to native overlap order. Serialized minimum/maximum sizes map to Figma size limits without a sidecar. Required layout-token aliases remain bound when unused-token import is disabled. Completed imports read back padding, gaps, radii, stroke geometry, component layout properties, and inherited layout aliases.

Sketch defines border-inclusive layout in terms of protruding child borders. Figma’s [strokesIncludedInLayout](https://developers.figma.com/docs/plugins/api/properties/nodes-strokesincludedinlayout/) enables border-box layout. Enabled conversions remain Partial pending native comparison of the two models; disabling border-inclusive layout is mapped directly. Sketch enums and limit serialization were also checked against the installed `SketchAPI_dom.js` and [Sketch’s API reference](https://developer.sketch.com/reference/api/).

Boolean mapping references: [Sketch operation enum](https://raw.githubusercontent.com/sketch-hq/sketch-document/main/packages/file-format/schema/enums/boolean-operation.schema.yaml), [Sketch fill rules](https://raw.githubusercontent.com/sketch-hq/sketch-document/main/packages/file-format/schema/enums/winding-rule.schema.yaml), [Figma vector regions](https://developers.figma.com/docs/plugins/api/VectorNetwork/), [Figma boolean operations](https://developers.figma.com/docs/plugins/api/figma/) and [native child stacking order](https://developers.figma.com/docs/plugins/api/properties/nodes-children/). Operation/contour readbacks do not certify rendered pixels.

Modern native operand constraints: [Figma fill/stroke geometry and unsupported Frame operands](https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations), [Sketch combined shapes](https://www.sketch.com/docs/designing/shapes/boolean-operations/). Copy-based operands are reported as editable equivalents, with original subtrees and bindings retained.
