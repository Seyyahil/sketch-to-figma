# Public repository test setup (2026-10-09)

`Test.sketch` is a private, separately supplied acceptance archive and is excluded from Git. Use `SKETCH_FIXTURE=/path/to/Test.sketch npm run check` for the full suite. Without an archive, the acceptance cases are explicitly skipped while unit tests run; an invalid explicitly supplied path fails instead of silently skipping. No fixture is downloaded, recreated or copied into the repository. Earlier references to the repository archive below describe historical runs.

Publication verification on 2026-10-09: `npm run check` without the archive passed 189 tests and explicitly skipped 13 acceptance cases; the full `SKETCH_FIXTURE` run against the externally supplied archive passed all 202 tests across 14 files. TypeScript and production builds passed in both modes. No native Figma import was performed.

# Resource-focused report (2026-10-09)

Verification: after repository cleanup on 2026-10-09, `npm run check` passed **202 tests across 14 files**, TypeScript and the production build. Native Figma verification was left to the user.

At the user's request, the panel report and its completion/button totals focus on **Color variables, Layer styles, Text styles, Symbols, and Tokens**. Dimensions, position, rotation, flips and boolean geometry do not appear or contribute to those displayed counts, regardless of their magnitude. The strict validator and complete stored audit retain their original checks and measurements; no converter threshold or source conversion behavior was relaxed. These full audits remain available to code through `readReport`.

Original Text Style bindings, including instance text, are separate from Layer Style/effect bindings. Explicit resource categories and source layer types disambiguate new reports; historical saved reports can fall back to their existing readback descriptions. Token collection/mode errors and component-inherited token bindings appear under Tokens. Related binding findings remain in Details without double-counting; standalone resource warnings, unverified checks and fatal import errors remain visible. A category with no checks says “No checks recorded”, not “passed”. Unrelated warnings remain in the full audit.

Report regressions cover category ordering, live and saved report counts, geometry exclusion, resource classification, mixed outcomes, layer navigation, instance-specific notes, token mode errors, malformed message categories and full-audit preservation. No native Figma document was changed.

# Shared boolean conversion pass (revision 10)

`npm run check` passed on 2026-10-09: TypeScript, **188 tests across 13 files**, and the production plugin/UI build. Built JavaScript parses successfully. The user-requested fixtures-folder removal remains in place; tests use `Test.sketch` and isolated in-memory inputs. Generated `node_modules` is removed after verification.

The shared importer distinguishes Sketch `None = -1` compound contours from Union, Subtract, Intersection, and Difference. A compound uses one native vector region containing all source loops with the original Evenodd or Nonzero rule. Test.sketch contains **73** such shapes: **55 Evenodd** and **18 Nonzero**, across the whole document. These counts and every original contour ID/name are checked from the real archive; the logos are examples, not a special conversion branch.

Explicit operations remain live native booleans in source order. Native operands with empty paints receive an internal operative fill; the combined shape owns the visible paint and no color/style resource is generated. Explicit clipping uses parity, verified with Sketch CLI self-overlap exports; pure compounds and lone operands retain the original parent fill rule. Frame, Symbol and nested combined operands use editable geometry copies when Figma cannot combine their source container directly. Complete original subtrees and bindings remain hidden and editable, and the lack of live synchronization between an operative copy and its retained original is reported. Compound vectors remain editable; their original contour layers and IDs are retained in a hidden container for source preservation and reimport. Editing those retained original operands does not automatically update the rendered compound. The report classifies that editability difference. Mixed compounds can resolve a disposable native clone; imported operands are not flattened. Native resolved representations that cannot preserve a compatible winding rule stop and recover the import with an explicit error. Open-path compound borders can include an implicit closing edge; that limitation is reported separately. No rasterization, new styles, Native QA plugin, or QA pages are introduced.

Regression coverage includes all four operations, same/opposite winding holes, native float rounding and equivalent loop traversal, first-operand semantics, self-overlapping paths, operative fills, Frame copies, mixed operations, nested shapes, source-order dependencies, visibility, transforms, Bézier handles, gradient coordinates, selective-import dependency resources, old converter upgrades, local conflicts, cancellation and failed-import recovery. Stronger fingerprints include native boolean operation and vector network values; legacy hash migration preserves real user edits without falsely treating every old import as locally modified. Old containers remain recoverable while their operands move, and source node IDs stay stable.

Sketch CLI exports confirmed the None/fill-rule distinction, a mixed Subtract/None island, explicit parity clipping and lone-operand parent fill rules in scratch references. Host-double tests include an independent filled-area oracle for straight-edge cases. The double does not render Figma curves, text outlines, Frame flattening, strokes, effects or images; native copy/flatten calls are API-orchestration stubs. No current native Figma import or pixel comparison was performed. The user will test the built plugin.

# Geometry-aware report validation (2026-10-09)

`npm run check` passed: TypeScript, **174 tests across 12 files**, and the rebuilt production plugin/UI. No native Figma import or render run was performed for this validation pass.

Dimension checks now compare unrotated frames for ordinary layers and actual unstroked path bounds for vectors, including Bézier extrema. Vector placement compares path-bound origins in the nearest source-bearing parent's coordinates, accounting for native origin rebasing and anonymous wrappers. Position/size tolerances remain 0.1px; rotation/skew use 0.01 degrees and scale uses 0.00001. Equivalent affine rotation/flip representations pass; reflection changes remain failures. Original frames, matrices, comparison bases and deltas remain in the audit. These checks do not certify stroke/effect appearance or full path topology.

The earlier validation pass compared 78 historical native path readbacks and found that the old raw-frame validator falsely flagged 62 sizes and all 78 positions. Those captures were removed with the fixtures folder at the user's request; the current suite does not repeat that historical comparison. Geometry unit tests and real Test.sketch contour checks remain. Historical captures did not certify rendered fidelity. The ISI height discrepancy remains a failing regression. Hug parent failures retain related direct-child size context without inferring a root cause or suppressing failures. Unreadable geometry is recorded as unchecked in the full audit and as a conversion finding.

Existing saved reports are historical snapshots; the next import/reimport runs the corrected validator. No converter revision bump or Figma document changes were made for this validation pass. The historical native failure counts below are unchanged records from the old comparison method.

# Text Style binding pass (revision 9)

`npm run check` passed on 2026-10-08: TypeScript, **131 tests across eight files**, and the rebuilt production plugin.

Exact Sketch typography takes priority, as confirmed by the user. Reconciliation tries original style bindings for every detached range, including host-supported overrides beyond semantic weight/decoration. It restores and verifies source values if binding is rejected, repairs empty copy without zero-length range calls, reports missing source styles as errors, and removes stale unbound-range warnings when final reconciliation succeeds. No additional Text Styles are generated.

Regression coverage accounts for all 116 style-linked and 48 literal text layers in the current Test.sketch, plus styled text inside Symbols. Every compatible range must retain its original style ID; every remaining detached range requires its own finding. The current fixture has 1,333 non-page layers (SHA-256 `959521944a8ad05be35e373a9a8f0098360033e8efea41113894eb7f6083434e`); the source file was not modified by this pass. Tests use the host double; native Figma rendering and binding acceptance are not certified by them.

# Current source-fidelity policy (revision 8)

The importer creates no Color/Paint Styles and no extra Text Styles. Literal colors remain literal; source swatches retain variable bindings. Original Text Styles bind where the host can retain exact source values; incompatible overrides remain literal and are reported. Legacy generated styles are removed only when importer-owned, unchanged and unused anywhere in the file.

On 2026-10-08, TypeScript, 126 tests in eight files, and the production build passed. Current automated checks cover Test.sketch's 29 color variables, 19 original Text Styles, zero generated Paint Styles, 48 unstyled text layers and exact SemiBold 22/24 heading overrides. These checks use a host double, not a renderer; 100% native visual fidelity is not certified. Historical measurements and remaining gaps follow below.

# Validation evidence and open release gates

The full 13-section, 203-requirement specification remains the acceptance contract. **Acceptance has not passed.** A completed import or a passing automated suite is not fidelity certification.

## Earlier automated checks

`npm run check` passed on 2026-10-08: TypeScript, **126 tests in eight test files**, and the main plugin/UI build. Those historical tests covered the repository Test document, then-retained public archives, exact source naming, resource bindings, source-only style reconciliation, nested Symbols, overrides, converter upgrades, conflict policies, token aliases, corrupt archives, source accounting, masks, and tiled images. Mock tests do not prove Figma rendering or responsive behavior.

The writable API surface is checked against `@figma/plugin-typings` 1.141.0. The repository has one plugin entry point, `manifest.json`. The importer reports conversion findings and retains original source metadata. Complete per-file audits remain compressed in document plugin data; the panel shows concise results. The standalone PNG comparison script is `scripts/compare-renders.mjs`.

UI regressions accept ready/progress/completion/error messages from nested host frames and null message sources, validate message payloads, and ignore stale request IDs. The real `Test.sketch` archive exercises asynchronous preparation of its three oversized source images with a mocked canvas renderer; preparation status clears on completion. This checks panel state transitions, not image pixel fidelity or native Figma execution.

Generated `node_modules` is removed after checks. Run `npm ci` before building or running tests again; the already built plugin does not require that folder at runtime.

## Test source inventory

`Test.sketch` version 196 contains three pages, 1,333 non-page layers, 49 Symbol Sources, 49 instances, 164 text layers, 181 Stacks, 29 color variables, 19 Text Styles, and three Layer Styles. Its SHA-256 at repository cleanup is `c1430e9f0d5005f024eaa34c27e40ada3d4b89e8bdd963bc1d733f05183698c2`. The earlier native evidence used `d522c62035fb7661ed9f1817cd9edb1204fd66b6fce0fdb0fae8296ce8751e0f`, which has 1,333 non-page layers. No numeric layout-token file accompanies it; literal values remain literals; no variables or styles are inferred for source-unstyled text. No additional styles are created for source overrides.

Exact source names are checked for imported layers/components, original Text/Layer Styles, and color variables. Original slashes remain. Fill and stroke colors remain direct values; compatible effects retain the source style name. Source renames reuse original resource IDs, subject to explicit mappings and local-edit conflict policy.

Compatible Text Styles are applied before updating characters, without first clearing the binding. Identical font and character assignments are skipped. Revision 7 used deduplicated local override Text Styles; revision 8 removes that behavior under the source-only policy. The revision-7 host-double checks bound all ranges of 116 source-styled text layers, leave all 48 source literals unstyled, and verify both “Tips for staying on schedule” headings at Poppins SemiBold 22px with 24px line height. The mock renderer/host does not prove native Figma appearance.

## Historical native measurement summary

The historical native readback used source version 196 and predates converter revisions 5–7. Its summary is retained below; the obsolete raw capture was removed during repository cleanup. These measurements are remaining-failure evidence, not acceptance of the current build. Current source changes have not been rerun in native Figma; the live Figma file is left as requested.

| Test.sketch native validation | Passed | Failed |
|---|---:|---:|
| Source layer mapping | 1,333 | 0 |
| Source parent hierarchy | 1,333 | 0 |
| Dimensions within 0.1px | 1,189 | 144 |
| Position/rotation/flips within tolerance | 1,221 | 112 |
| Color-variable bindings | 718 | 0 |
| Editable text content | 164 | 0 |
| Layer/Text/Paint Style bindings | 52 | 80 |
| Instance component links | 49 | 0 |
| Checked component overrides | 40 | 0 |
| Text Style bindings inside actual instances | 52 | 67 |

Both Test passes have **403 failed checks** and zero error-severity findings. Unchanged reimport creates zero source nodes or new resource identities. The 80 style failures comprise 66 text-style, 13 fill-style, and one stroke-style checks. The 67 instance-text failures inherit incompatible source typography overrides. They remain failures of full native binding preservation.

Of 164 text layers, 116 have live source Text Style references and 48 are source literals. The saved native readback has 50 fully bound referenced nodes, 22 with compatible ranges bound, and 44 with all ranges differing from the original style. Reapplying the named style to incompatible source values would alter the design; derived styles were prohibited during that historical run. They are prohibited by the current source-only policy. Both cases remain visible in the audit.

## Historical source-render comparison summary

The following results summarize the earlier version-196 render run. They do not certify the current converter. Its obsolete reference PNGs, Figma samples, metrics files and heatmaps were removed during repository cleanup. Comparison uses equal dimensions, top-left alignment, no resampling, and a changed-pixel threshold of any RGBA channel differing by more than 16/255. Zero changed pixels is the pass condition.

| Sample | Dimensions | Changed pixels | Mean absolute channel error /255 | Result |
|---|---|---:|---:|---|
| Mobile support | 375×1,212 | 8.8108% | 4.9190 | Fail |
| Desktop support | 600×1,100 | 5.8692% | 3.5140 | Fail |
| Mobile AA footer | 375×290 | 13.0538% | 6.5461 | Fail |

Font-renderer and color-profile differences are not subtracted or excused. Three sampled frames do not certify a full file.

## Remaining release gates

All 203 checklist rows remain authoritative. Open gates include native geometry, transform, style-binding and pixel failures; per-glyph appearance checks; multi-size responsive behavior; hidden-child spacing; inherited tint and oversized image overrides; advanced corners, paths and typography; external libraries and multiple variable modes; richer prototypes and generated-arrangement reimport identity; native interruption recovery; and large-file performance budgets.

The main panel has a centered drop area, five switches for unused resources, with supplied token JSON accepted by drag and drop. Its light/dark and loaded-file layouts were inspected in an isolated local browser. Queue/switch/font/cancellation/revision behavior has automated browser-logic checks. Native Figma panel interaction verification remains open. Unknown or unsupported properties remain in the source ledger and metadata. Recovery is best effort. **The plugin is not yet production-ready or 100% preserving.**

## Current revision-6 additions

Required resources are retained even when unused-resource switches are off. Regressions cover nested Symbol/style swaps, exact names, mode-specific token alias closure, component padding aliases, original Text Style bindings, source revision replacement, and audit storage/corruption handling. Real Test.sketch coverage exercises source Stacks and required resources with category switches disabled, including post-conversion padding/gap/radius/border checks.

Serialized Stack overlap order is no longer hardcoded. Serialized per-axis minimum/maximum limits are applied and cleared on reimport. Enabled border-inclusive layout remains explicitly Partial because Sketch and Figma describe different border measurement models. New native readback checks include inherited component layout properties and aliases. These checks detect failures; their presence alone does not prove native acceptance. No synthetic test fixture or QA plugin is part of the production import flow.

## Empty-text font-loading regression

On 2026-10-08, `npm run check` passed with **117 tests across eight test files**, TypeScript checking, and the rebuilt production plugin. Font loading now uses the insertion font for new or empty Text/TextPath nodes instead of calling `getRangeAllFontNames(0, 0)`. Font-token preparation uses the same guard. The host double now rejects empty font ranges, and regression tests cover fresh text, empty-text reimport, and mixed fonts with variation settings. This fixes the reported import abort; conversion-difference counts remain separate fidelity findings.

Native verification after the empty-text fix, before revision-7 style reconciliation: reopened the development plugin from the rebuilt `dist` files and imported the original `Test.sketch` in Figma Desktop. The import completed and the panel reported **Imported · 99057 differences · 386 failed checks**, with no empty-range abort. These remaining findings are conversion-fidelity work, not evidence of full acceptance. The imported content was left in the active Figma document.


## Historical revision-7 Text Style bindings (superseded)

Matching ranges retain original Text Styles. Native semantic overrides are accepted only after checking the resulting style ID and every style-owned value/alias. Other source-style overrides use exact deduplicated local Text Styles. The index and style metadata retain the original Sketch style ID, original Figma resource ID and captured typography. Identical overrides share resources across pages and reimports. Modified derived resources are retained rather than silently overwritten. Final instance repair respects nested/outer Text Style swaps and does not rewrite master audits.

Regressions cover both retaining and detaching host behavior, mixed ranges, reuse across pages/reimports, source literals, typography-token aliases, local resource edits, rejected style creation with exact-value recovery, instance binding repair and independent master audits. Current native verification is still open. No native QA plugin or synthetic production import was added. Native binding and rendering acceptance are still unverified for this build.

## Historical native typography and color observations

In the 2026-10-08 Global/Mobile/ISI investigation, Figma's editor retained the ISI-Body style with a semantic Bold override. Automatic font assignment, font-weight/style variable binding and JSX experiments did not reproduce that linked override. Cloning a manually prepared native template worked but was rejected because import must be automatic. Native bold/style preservation remains unresolved; this cleanup does not change conversion behavior.

A later native color check read all 29 imported color variables and found their displayed hex values matched the source, including Gray_80 #646464 and Gray_90 #494949. That observation does not establish current typography, component or visual fidelity. The old rollback notes and raw readbacks have been removed; the current source and specification remain authoritative.
