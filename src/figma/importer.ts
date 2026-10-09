import { writeReport } from "./report-storage";
import { applyOpacityMask } from "./opacity-masks";
import { finishReport, Ledger } from "../core/audit";
import { dependencyOrder, masters } from "../core/dependencies";
import { resourceSelection } from "../core/resource-selection";
import { fingerprint, transform } from "../core/math";
import {
  DEFAULT_OPTIONS,
  ownSource,
  sourceId,
  walkLayers,
  type ConversionReport,
  type ImportOptions,
  type LayerAudit,
  type Sketch,
  type SketchFile,
} from "../core/types";
import { ImportContext } from "./context";
import {
  Journal,
  mapping,
  readData,
  readIndex,
  targetFingerprint,
  writeData,
  writeIndex,
  recover,
  type JournalData,
} from "./storage";
import { applyAppearance } from "./appearance";
import { applyGeometry, createNode } from "./geometry";
import { applyText, loadCurrentFonts } from "./typography";
import { applyChildLayout, applyGuidesGrids, applyLayout } from "./layout";
import {
  bindStyles,
  importResources,
  removeUnusedGeneratedStyles,
} from "./resources";
import { applyOverrides, componentProperties } from "./symbols";
import { applyPrototypes } from "./prototypes";
import { applyTokenBindings } from "./token-bindings";
import { reconcileTextStyleBindings } from "./text-style-bindings";
import { instanceTextSources } from "./instance-text-styles";
import { validateImport } from "./validation";
import { applyBooleanShape, prepareBooleanRebuild } from "./booleans";
import { sourceRelativeTransform } from "./geometry-validation";
export interface ImportRun {
  cancel(): void;
  result: Promise<ConversionReport>;
}
export function startImport(
  api: PluginAPI,
  input: SketchFile,
  options: ImportOptions = DEFAULT_OPTIONS,
  libraries: SketchFile[] = [],
  progress: (done: number, name: string) => void = () => {},
): ImportRun {
  let ctx: ImportContext | undefined,
    cancelled = false;
  const result = (async () => {
    await api.loadAllPagesAsync();
    const prior = readData<JournalData | null>(api.root, "journal", null);
    if (prior) {
      const errors = await recover(api, prior);
      if (errors.length)
        throw new Error(`Recovery required: ${errors.join("; ")}`);
    }
    const file = withLibraries(input, libraries),
      index = readIndex(api, file.documentId),
      journal = new Journal(api, index);
    const report: ConversionReport = {
      schemaVersion: 1,
      file: file.name,
      documentId: file.documentId,
      sourceVersion: file.version,
      startedAt: new Date().toISOString(),
      state: "running",
      layers: [],
      findings: [...file.warnings],
      validations: [],
      totals: {
        Native: 0,
        "Editable Equivalent": 0,
        "Visual Equivalent": 0,
        Partial: 0,
        Unsupported: 0,
      },
      created: 0,
      reused: 0,
      updated: 0,
      preserved: 0,
      visualValidation: "not-run",
      apiVersion: api.apiVersion,
      sourceMetadataPreserved: false,
    };
    ctx = new ImportContext(
      api,
      file,
      options,
      report,
      index,
      journal,
      progress,
    );
    ctx.cancelled = cancelled;
    const c = ctx;
    const plan = resourceSelection(file, options);
    c.resourceSelection = plan;
    const scope = plan.scope,
      available = masters(file),
      needed = plan.symbols,
      mutable = new Set<string>();
    const sourceById = new Map(
      walkLayers(file.pages).map((s) => [sourceId(s), s]),
    );
    for (const master of available.values())
      for (const s of walkLayers([master])) sourceById.set(sourceId(s), s);
    const parentSources = new Map<string, Sketch>();
    for (const p of walkLayers(file.pages))
      for (const child of p.layers ?? []) parentSources.set(sourceId(child), p);
    const preservedIds = new Set<string>();
    const initialTarget = new Map<string, string>();
    for (const [id, m] of Object.entries(index.nodes)) {
      const n = await api.getNodeByIdAsync(m.nodeId);
      if (n && "visible" in n)
        initialTarget.set(
          id,
          await targetFingerprint(n as SceneNode, m.targetHashVersion ?? 1),
        );
    }
    let resourcePage: PageNode | undefined;
    const pages = new Map<string, PageNode>();
    async function pageFor(p: Sketch): Promise<PageNode> {
      const id = sourceId(p);
      if (pages.has(id)) return pages.get(id)!;
      let page: PageNode | undefined;
      const mapped = options.destinationPageId ?? index.pages[id];
      if (mapped) {
        const n = await api.getNodeByIdAsync(mapped);
        if (n?.type === "PAGE") page = n;
      }
      if (!page) {
        page = api.createPage();
        journal.track(page);
        page.name = p.name;
        report.created++;
      } else if (options.destinationPageId)
        ctx!.finding(
          "DESTINATION_PAGE",
          "Imported source page mapped into the chosen destination page.",
          p,
          undefined,
          "info",
        );
      journal.beforePage(page);
      if (!options.destinationPageId) {
        page.name = p.name;
        page.setPluginData("sketch2figma:sourceId", id);
      }
      index.pages[id] = page.id;
      pages.set(id, page);
      const l = c.ledger(p);
      l.result.targetId = page.id;
      l.fields("", ["_class", "do_objectID", "name"]);
      await applyGuidesGrids(c, p, page);
      page.setPluginData("sketch2figma:documentId", file.documentId);
      writeData(page, "source", ownSource(p));
      return page;
    }
    async function resourcesPage(): Promise<PageNode> {
      if (resourcePage) return resourcePage;
      const old = index.pages.__resources;
      if (old) {
        const n = await api.getNodeByIdAsync(old);
        if (n?.type === "PAGE") resourcePage = n;
      }
      if (!resourcePage) {
        resourcePage = api.createPage();
        journal.track(resourcePage);
        resourcePage.name = `${file.name} / Components`;
        index.pages.__resources = resourcePage.id;
      }
      return resourcePage;
    }
    async function existing(s: Sketch): Promise<SceneNode | undefined> {
      const record = index.nodes[sourceId(s)];
      if (!record) return undefined;
      const n = await api.getNodeByIdAsync(record.nodeId);
      return n && "visible" in n ? (n as SceneNode) : undefined;
    }
    function restoreAudits(s: Sketch, node: SceneNode, local = false): void {
      for (const source of walkLayers([s])) {
        const old = index.nodes[sourceId(source)];
        const n = c.nodes.get(sourceId(source));
        const ledger = c.ledger(source);
        const saved = n ? readData<LayerAudit | null>(n, "audit", null) : null;
        if (saved) {
          ledger.result.properties = saved.properties;
          for (const p of saved.properties)
            ledger.mark(
              p.path,
              local ? "Partial" : p.status,
              local
                ? "Local Figma edits preserved; source value was not reapplied."
                : p.reason,
            );
        }
        ledger.result.targetId = n?.id ?? old?.nodeId;
      }
      if (local)
        c.finding(
          "LOCAL_CONFLICT",
          `${s.name}: locally modified subtree preserved.`,
          s,
        );
    }
    async function hydrate(s: Sketch): Promise<void> {
      for (const source of walkLayers([s])) {
        const n = await existing(source);
        if (n) c.nodes.set(sourceId(source), n);
        c.processed.add(sourceId(source));
      }
    }
    async function build(
      s: Sketch,
      parent: BaseNode & ChildrenMixin,
      dependency = false,
    ): Promise<SceneNode> {
      const id = sourceId(s);
      if (c.processed.has(id) && c.nodes.has(id)) return c.nodes.get(id)!;
      await c.tick(s);
      let node = await existing(s);
      const old = index.nodes[id];
      const fresh = !node;
      if (node && old) {
        const hash = fingerprint(s),
          target =
            initialTarget.get(id) ??
            (await targetFingerprint(node, old.targetHashVersion ?? 1)),
          local = target !== old.targetHash,
          complete = walkLayers([s])
            .filter(
              (child) =>
                dependency ||
                s._class === "symbolMaster" ||
                scope.has(sourceId(child)),
            )
            .every((child) => initialTarget.has(sourceId(child)));

        if (
          (hash === old.sourceHash &&
            old.conversionHash === c.conversionHash &&
            !local &&
            complete) ||
          (local && options.conflict === "preserve-local")
        ) {
          await hydrate(s);
          restoreAudits(s, node, local);
          if (local) {
            report.preserved++;
            for (const child of walkLayers([s]))
              preservedIds.add(sourceId(child));
          } else {
            report.reused++;
            await journal.before(node);
            const carrier =
              node.parent?.type === "FRAME" &&
              node.parent.getPluginData("sketch2figma:fadeFor") === id
                ? node.parent
                : node;
            if (carrier !== node) await journal.before(carrier);
            const position = sourceRelativeTransform(carrier);
            parent.appendChild(carrier);
            carrier.relativeTransform = position;
          }
          return node;
        }
        if (
          (node.type === "INSTANCE" && s._class !== "symbolInstance") ||
          (node.type === "COMPONENT" && s._class !== "symbolMaster") ||
          (s._class === "symbolInstance" && node.type !== "INSTANCE")
        ) {
          c.finding(
            "TYPE_CONFLICT",
            "Source node type changed; existing editable node preserved to protect component relationships.",
            s,
            undefined,
            "error",
          );
          await hydrate(s);
          restoreAudits(s, node, true);
          return node;
        }
        await journal.before(node);
        if (node.type === "TEXT" || node.type === "TEXT_PATH")
          await loadCurrentFonts(c, node);
        report.updated++;
      } else {
        if (s._class === "symbolInstance") {
          const component = c.resources.components.get(String(s.symbolID));
          if (component) node = component.createInstance();
          else {
            node = createNode(c, { ...s, _class: "missingSymbol" });
            c.finding(
              "MISSING_SYMBOL",
              `Missing Symbol ${s.symbolID}; editable placeholder retains source dimensions and overrides.`,
              s,
              "/symbolID",
              "error",
            );
          }
        } else node = createNode(c, s);
        journal.track(node);
        report.created++;
      }
      if (node.type === "TEXT" || node.type === "TEXT_PATH")
        await loadCurrentFonts(c, node);
      const obsoleteFade =
        node.parent?.type === "FRAME" &&
        node.parent.getPluginData("sketch2figma:fadeFor") === id
          ? node.parent
          : undefined;
      if (obsoleteFade) {
        await journal.before(obsoleteFade);
        obsoleteFade.visible = false;
        c.cleanup.add(obsoleteFade);
      }
      parent.appendChild(node);
      c.nodes.set(id, node);
      c.processed.add(id);
      mutable.add(id);
      node.setPluginData("sketch2figma:sourceId", id);
      node.setPluginData("sketch2figma:documentId", file.documentId);
      node.setRelaunchData({ open: `Reimport ${file.name}` });
      if (!fresh && node.type !== "INSTANCE") {
        if ("setFillStyleIdAsync" in node) await node.setFillStyleIdAsync("");
        if ("setStrokeStyleIdAsync" in node)
          await node.setStrokeStyleIdAsync("");
        if ("setEffectStyleIdAsync" in node)
          await node.setEffectStyleIdAsync("");
        // A live source Text Style is applied before editing text. Clearing it
        // here would detach compatible text on every converter upgrade/reimport.
        if (node.type === "TEXT" && !c.resources.texts.has(s.sharedStyleID))
          await node.setTextStyleIdAsync("");
      }
      await applyGeometry(c, s, node);
      if (s._class !== "shapeGroup") await applyAppearance(c, s, node);
      if (
        (node.type === "TEXT" || node.type === "TEXT_PATH") &&
        s._class === "text"
      )
        try {
          await applyText(c, s, node, () => bindStyles(c, s, node!));
        } catch (e) {
          c.finding("TEXT_FAILURE", String(e), s, "/attributedString", "error");
        }
      if ("children" in node && node.type !== "INSTANCE") {
        // Snapshot every shape operand before moving ANY sibling. Capturing
        // later siblings after earlier moves loses their original stacking index.
        if (s._class === "shapeGroup") {
          const operands: SceneNode[] = [];
          for (const child of s.layers ?? []) {
            const priorOperand = await existing(child);
            if (priorOperand) {
              await journal.before(priorOperand);
              operands.push(priorOperand);
            }
          }
          await prepareBooleanRebuild(c, s, operands);
        }
        for (const child of s.layers ?? [])
          if (
            scope.has(sourceId(child)) ||
            s._class === "symbolMaster" ||
            dependency
          )
            await build(child, node, dependency || s._class === "symbolMaster");
        await applyLayout(c, s, node);
        for (const child of s.layers ?? []) {
          const cn = c.nodes.get(sourceId(child));
          if (cn) await applyChildLayout(c, child, cn);
        }
      }
      if (s._class === "shapeGroup" && node.type === "FRAME")
        try {
          await applyBooleanShape(c, s, node);
        } catch (error) {
          c.finding("BOOLEAN_CONVERSION", String(error), s, "/layers", "error");
          throw error;
        }
      if (node.type === "INSTANCE") {
        const component = c.resources.components.get(String(s.symbolID));
        if (
          component &&
          (await node.getMainComponentAsync())?.id !== component.id
        )
          node.swapComponent(component);
        if (!fresh) node.removeOverrides();
        // Figma resets root instance plugin data to the component's metadata
        // when overrides are removed. Restore its own source identity before
        // any containing instance resolves a nested Sketch override path.
        node.setPluginData("sketch2figma:sourceId", id);
        node.setPluginData("sketch2figma:documentId", file.documentId);
        node.setRelaunchData({ open: `Reimport ${file.name}` });
        // Geometry and appearance are source overrides too; reset precedes them.
        await applyGeometry(c, s, node);
        await applyAppearance(c, s, node);
        await applyOverrides(c, s, node);
        c.ledger(s).mark("/symbolID");
      }
      if (node.type === "COMPONENT") {
        await componentProperties(c, s, node);
        c.resources.components.set(String(s.symbolID), node);
        c.ledger(s).mark("/symbolID");
      }
      await applyGuidesGrids(c, s, node);
      if (node.type !== "TEXT")
        await bindStyles(
          c,
          s,
          s._class === "shapeGroup" && "children" in node
            ? (node.children.find(
                (child) =>
                  child.getPluginData("sketch2figma:wrapper") === "boolean" &&
                  !child.getPluginData("sketch2figma:obsolete"),
              ) ?? node)
            : node,
        );
      c.ledger(s).result.targetId = node.id;
      writeData(node, "source", ownSource(s));
      return node;
    }
    try {
      c.fonts = await api.listAvailableFontsAsync();
      await importResources(c);
      const dep = dependencyOrder(available);
      for (const cycle of dep.cycles)
        c.finding(
          "SYMBOL_CYCLE",
          cycle.join(" → "),
          undefined,
          undefined,
          "error",
        );
      for (const master of dep.ordered) {
        const symbol = String(master.symbolID);
        if (!needed.has(symbol)) continue;
        const map = options.componentMap[symbol];
        if (map) {
          try {
            const component = map.startsWith("key:")
              ? await api.importComponentByKeyAsync(map.slice(4))
              : await api.getNodeByIdAsync(map);
            if (!component || component.type !== "COMPONENT")
              throw new Error("Replacement must be a component.");
            c.resources.components.set(symbol, component);
            c.finding(
              "COMPONENT_MAPPING",
              `${master.name}: linked to an explicitly mapped Figma component.`,
              master,
              "/symbolID",
              "info",
            );
            continue;
          } catch (e) {
            c.finding(
              "COMPONENT_MAPPING",
              String(e),
              master,
              "/symbolID",
              "error",
            );
          }
        }
        const p = parentSources.get(sourceId(master));
        const parent =
          p?._class === "page" && scope.has(sourceId(p))
            ? await pageFor(p)
            : await resourcesPage();
        const component = await build(master, parent, true);
        if (component.type === "COMPONENT")
          c.resources.components.set(symbol, component);
      }
      for (const p of file.pages) {
        if (!scope.has(sourceId(p))) continue;
        const page = await pageFor(p);
        for (const s of p.layers ?? [])
          if (scope.has(sourceId(s))) {
            const node = await build(s, page);
            if (node.parent?.id !== page.id && mutable.has(sourceId(s)))
              page.appendChild(node);
          }
      }
      // Auto Layout setters can move a fixed container while recalculating its
      // intrinsic bounds. Restore source placement once ancestor sizing settles.
      // Vector networks normalize their local bounds; their offsets are intentional.
      for (const source of walkLayers(file.pages)) {
        const node = c.nodes.get(sourceId(source));
        if (!node || !mutable.has(sourceId(source)) || node.type === "VECTOR")
          continue;
        const parent = node.parent;
        if (
          parent?.type === "PAGE" ||
          (parent && "layoutMode" in parent && parent.layoutMode === "NONE") ||
          ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE")
        ) {
          await journal.before(node);
          node.relativeTransform = transform(source);
        }
      }
      for (const p of file.pages)
        for (const container of walkLayers(p.layers ?? []))
          if (mutable.has(sourceId(container))) {
            const node = c.nodes.get(sourceId(container));
            if (node && "children" in node && node.type !== "INSTANCE")
              await reconstructMasks(c, container, node);
          }
      for (const source of walkLayers(file.pages)) {
        const node = c.nodes.get(sourceId(source));
        if (node && !preservedIds.has(sourceId(source)))
          await applyOpacityMask(c, source, node);
      }
      await applyTokenBindings(c, preservedIds);
      // Token bindings and Symbol content overrides can affect final text ranges.
      // Reconcile mutable masters/layers first, then their actual instance descendants.
      for (const [id, node] of c.nodes) {
        const source = sourceById.get(id);
        if (source && mutable.has(id) && node.type === "TEXT")
          await reconcileTextStyleBindings(c, source, node);
      }
      for (const [id, node] of c.nodes) {
        const source = sourceById.get(id);
        if (source && mutable.has(id) && node.type === "INSTANCE")
          for (const text of instanceTextSources(node, source))
            await reconcileTextStyleBindings(c, text.source, text.node, source);
      }
      await applyPrototypes(c, mutable);
      await validateImport(c, scope);
      const live = new Set(walkLayers(file.pages).map(sourceId));
      for (const [id, m] of Object.entries(index.nodes))
        if (!live.has(id))
          c.finding(
            "SOURCE_REMOVED",
            `Source layer ${id} is absent; imported target ${m.nodeId} retained to avoid deleting local work.`,
            undefined,
            id,
          );
      for (const [id, node] of c.nodes) {
        const source = sourceById.get(id);
        if (source && !node.removed) {
          if (!preservedIds.has(id))
            index.nodes[id] = await mapping(node, source, c.conversionHash);
          const ledger = c.ledgers.get(id);
          if (ledger) writeData(node, "audit", ledger.finalize());
        }
      }
      const docSource = {
        ...input.document,
        _class: "document",
        do_objectID: `${file.documentId}:document`,
        name: file.name,
      };
      c.ledger(docSource);
      const metaSource = {
        ...input.meta,
        _class: "sourceMetadata",
        do_objectID: `${file.documentId}:meta`,
        name: "Sketch metadata",
      };
      c.ledger(metaSource);
      const userSource = {
        ...input.user,
        _class: "sourceUserData",
        do_objectID: `${file.documentId}:user`,
        name: "Sketch user data",
      };
      c.ledger(userSource);
      writeData(api.root, `source:${file.documentId}`, {
        document: input.document,
        suppliedTokens: options.tokens,
        meta: input.meta,
        user: input.user,
        libraries: libraries.map((l) => ({
          documentId: l.documentId,
          document: l.document,
          meta: l.meta,
        })),
      });
      index.sourceDigest = file.digest;
      writeIndex(api, index);
      journal.commit();
      try {
        await removeUnusedGeneratedStyles(c);
        writeIndex(api, index);
      } catch (error) {
        c.finding("LEGACY_STYLE_CLEANUP", String(error));
      }
      try {
        for (const obsolete of c.cleanup)
          if (!obsolete.removed) obsolete.remove();
      } catch (error) {
        c.finding("OWNED_NODE_CLEANUP", String(error));
      }
      // Empty owned wrappers are safe to remove only once all imported mutations commit.
      try {
        for (const page of pages.values())
          for (const wrapper of page.findAll(
            (n) =>
              n.type === "FRAME" &&
              n.getPluginData("sketch2figma:wrapper") === "mask" &&
              n.getPluginData("sketch2figma:documentId") === file.documentId &&
              n.findAll(
                (child) => !!child.getPluginData("sketch2figma:sourceId"),
              ).length === 0,
          ))
            wrapper.remove();
      } catch (e) {
        c.finding("WRAPPER_CLEANUP", String(e));
      }
      report.sourceMetadataPreserved = true;
      report.state = "complete";
      const pageList = [...pages.values()];
      const last = pageList[pageList.length - 1];
      if (last)
        try {
          await api.setCurrentPageAsync(last);
        } catch (e) {
          c.finding("PAGE_FOCUS", String(e));
        }
    } catch (e) {
      report.state = String(e).includes("IMPORT_CANCELLED")
        ? "cancelled"
        : "failed";
      c.finding("IMPORT_STOPPED", String(e), undefined, undefined, "error");
      const errors = await journal.rollback();
      for (const error of errors)
        c.finding("RECOVERY_FAILURE", error, undefined, undefined, "error");
      report.sourceMetadataPreserved = false;
    }
    for (const source of walkLayers(input.pages))
      if (!c.ledgers.has(sourceId(source))) c.ledger(source, false);
    c.finish();
    finishReport(report);
    try {
      writeReport(api.root, report);
    } catch (error) {
      c.finding(
        "AUDIT_STORAGE",
        `Conversion audit could not be saved: ${error}`,
        undefined,
        undefined,
        "error",
      );
    }
    return report;
  })();
  return {
    cancel() {
      cancelled = true;
      if (ctx) ctx.cancelled = true;
    },
    result,
  };
}
async function reconstructMasks(
  ctx: ImportContext,
  s: Sketch,
  parent: SceneNode & ChildrenMixin,
): Promise<void> {
  const layers = s.layers ?? [];
  for (let i = 0; i < layers.length; i++) {
    const source = layers[i];
    if (!source.hasClippingMask) continue;
    const mask = ctx.nodes.get(sourceId(source));
    if (!mask || !("isMask" in mask)) continue;
    const siblings: SceneNode[] = [mask];
    for (let j = i + 1; j < layers.length; j++) {
      if (layers[j].shouldBreakMaskChain || layers[j].hasClippingMask) break;
      const n = ctx.nodes.get(sourceId(layers[j]));
      if (n && n.parent?.id === parent.id) siblings.push(n);
    }
    for (const n of siblings) await ctx.journal.before(n);
    if (siblings.length > 1) {
      const wrapper = ctx.api.createFrame();
      ctx.journal.track(wrapper);
      wrapper.name = `Mask / ${source.name}`;
      wrapper.fills = [];
      wrapper.clipsContent = false;
      wrapper.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
      wrapper.resize(
        Math.max(0.01, parent.width),
        Math.max(0.01, parent.height),
      );
      const index = (parent.children as readonly SceneNode[]).indexOf(mask);
      parent.insertChild(Math.max(0, index), wrapper);
      wrapper.x = 0;
      wrapper.y = 0;
      for (const n of siblings) {
        const position = n.relativeTransform;
        wrapper.appendChild(n);
        n.relativeTransform = position;
      }
      wrapper.setPluginData("sketch2figma:wrapper", "mask");
      wrapper.setPluginData("sketch2figma:documentId", ctx.file.documentId);
    }
    const outline = source.clippingMaskMode === 0;
    const visibleAppearance =
      source.isVisible !== false &&
      (source.image ||
        [
          source.style?.fills,
          source.style?.borders,
          source.style?.shadows,
        ].some((values) =>
          (values ?? []).some((value: Sketch) => value.isEnabled !== false),
        ));
    // Sketch outline masks still draw their own appearance. Figma masks do not.
    // Retain that appearance behind the masking geometry, with native bindings.
    if (outline && visibleAppearance) {
      const appearance = mask.clone();
      ctx.journal.track(appearance);
      const clearIdentity = (n: SceneNode) => {
        n.setPluginData("sketch2figma:sourceId", "");
        if ("children" in n)
          for (const child of n.children) clearIdentity(child);
      };
      clearIdentity(appearance);
      appearance.isMask = false;
      appearance.name = `Mask appearance / ${source.name}`;
      appearance.setPluginData("sketch2figma:wrapper", "outline-paint");
      appearance.setPluginData("sketch2figma:documentId", ctx.file.documentId);
      const container = mask.parent! as BaseNode & ChildrenMixin;
      const position = mask.relativeTransform;
      container.insertChild(container.children.indexOf(mask), appearance);
      appearance.relativeTransform = position;
      const painted =
        source._class === "shapeGroup" && "children" in appearance
          ? (appearance.children.find(
              (child) =>
                child.getPluginData("sketch2figma:wrapper") === "boolean" &&
                !child.getPluginData("sketch2figma:obsolete"),
            ) ?? appearance)
          : appearance;
      await applyAppearance(ctx, source, painted);
      await bindStyles(ctx, source, painted);
    }
    mask.isMask = true;
    const boolean =
      "children" in mask
        ? mask.children.find(
            (child) =>
              child.getPluginData("sketch2figma:wrapper") === "boolean" &&
              !child.getPluginData("sketch2figma:obsolete"),
          )
        : undefined;
    mask.maskType = outline && !boolean ? "VECTOR" : "ALPHA";
    if (outline) {
      const geometry = boolean ?? mask;
      if (
        "fills" in geometry &&
        (typeof geometry.fills === "symbol" ||
          !geometry.fills.some(
            (p) => p.visible !== false && (p.opacity ?? 1) > 0,
          ))
      ) {
        geometry.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      }
      if ("effects" in geometry) geometry.effects = [];
      ctx.finding(
        "OUTLINE_MASK_GEOMETRY",
        "Outline geometry retained as a native mask. Visible source mask appearance is preserved behind it as an editable layer; empty source fills use opaque masking geometry only.",
        source,
        "/hasClippingMask",
        "info",
      );
    }
    ctx
      .ledger(source)
      .fields(
        "",
        ["hasClippingMask", "clippingMaskMode"],
        "Editable Equivalent",
        "Native mask bounded by an editable wrapper to preserve Sketch mask-chain scope.",
      );
  }
}
function withLibraries(file: SketchFile, libs: SketchFile[]): SketchFile {
  if (!libs.length) return file;
  const known = masters(file),
    foreign = [...(file.document.foreignSymbols ?? [])],
    assets = [...file.assets];
  for (const lib of libs) {
    for (const [id, s] of masters(lib))
      if (!known.has(id)) {
        known.set(id, s);
        foreign.push({
          symbolMaster: s,
          libraryID: lib.documentId,
          sourceLibraryName: lib.name,
        });
      }
    for (const a of lib.assets)
      if (!assets.some((x) => x.path === a.path)) assets.push(a);
  }
  return {
    ...file,
    document: {
      ...file.document,
      foreignSymbols: foreign,
      layerStyles: {
        ...file.document.layerStyles,
        objects: [
          ...(file.document.layerStyles?.objects ?? []),
          ...libs.flatMap((l) => l.document.layerStyles?.objects ?? []),
        ],
      },
      layerTextStyles: {
        ...file.document.layerTextStyles,
        objects: [
          ...(file.document.layerTextStyles?.objects ?? []),
          ...libs.flatMap((l) => l.document.layerTextStyles?.objects ?? []),
        ],
      },
      sharedSwatches: {
        ...file.document.sharedSwatches,
        objects: [
          ...(file.document.sharedSwatches?.objects ?? []),
          ...libs.flatMap((l) => l.document.sharedSwatches?.objects ?? []),
        ],
      },
    },
    assets,
  };
}
