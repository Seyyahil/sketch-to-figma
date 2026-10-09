import { textStyleValues } from "./text-style-values";
import { includeUnused } from "../core/resource-selection";
import { fingerprint } from "../core/math";
import { escapePointer } from "../core/audit";
import {
  sourceId,
  type Sketch,
  type TokenFile,
  type ResourceKind,
} from "../core/types";
import { effects, paint, solidPaint } from "./appearance";
import { resolveFont, sameValue } from "./typography";
import { readData, writeData } from "./storage";
import type { ImportContext } from "./context";
export interface ResourceRecord {
  sourceHash: string;
  targetHash: string;
}
const styleSnapshot = (s: BaseStyle): unknown =>
  s.type === "PAINT"
    ? { name: s.name, paints: s.paints }
    : s.type === "EFFECT"
      ? { name: s.name, effects: s.effects }
      : s.type === "TEXT"
        ? {
            name: s.name,
            fontName: s.fontName,
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            letterSpacing: s.letterSpacing,
            paragraphSpacing: s.paragraphSpacing,
            paragraphIndent: s.paragraphIndent,
            textCase: s.textCase,
            textDecoration: s.textDecoration,
          }
        : s.type === "GRID"
          ? { name: s.name, layoutGrids: s.layoutGrids }
          : { name: s.name, type: s.type };
function remember(
  ctx: ImportContext,
  key: string,
  source: Sketch,
  target: BaseStyle | Variable,
): void {
  ctx.index.resources[key] = target.id;
  ctx.index.resourceStates ??= {};
  ctx.index.resourceStates[key] = {
    sourceHash: fingerprint(source),
    conversionHash: ctx.conversionHash,
    targetHash: fingerprint(
      "resolvedType" in target
        ? { name: target.name, valuesByMode: target.valuesByMode }
        : styleSnapshot(target),
    ),
  };
}
async function style(
  ctx: ImportContext,
  key: string,
  type: "EFFECT" | "TEXT",
  name: string,
  source: Sketch,
  apply: (s: BaseStyle) => Promise<void>,
): Promise<BaseStyle> {
  const mapped = ctx.options.styleMap[key],
    id = mapped ?? ctx.index.resources[key];
  let resource = id
    ? id.startsWith("key:")
      ? await ctx.api.importStyleByKeyAsync(id.slice(4))
      : await ctx.api.getStyleByIdAsync(id)
    : null;
  if (mapped && !resource)
    throw new Error(`Explicit style mapping ${key} was not found: ${mapped}`);
  if (resource && resource.type !== type) {
    ctx.finding(
      "STYLE_TYPE",
      `Mapped style ${key} is ${resource.type}; expected ${type}.`,
      source,
      key,
      "warning",
      type === "TEXT" ? "textStyles" : "layerStyles",
    );
    if (mapped)
      throw new Error(
        `Explicit style mapping ${key} has incompatible type ${resource.type}; expected ${type}.`,
      );
    resource = null;
  }
  if (mapped && resource) {
    ctx.finding(
      "STYLE_MAPPING",
      `Using explicitly mapped existing style ${name}.`,
      undefined,
      key,
      "info",
    );
    ctx.index.resources[key] = resource.id;
    return resource;
  }
  if (resource) {
    const record = ctx.index.resourceStates?.[key];
    const targetUnchanged =
      record && fingerprint(styleSnapshot(resource)) === record.targetHash;
    // Migrate only recognized importer-added suffixes on importer-owned styles.
    // Other local edits and explicit resource mappings keep their conflict policy.
    const legacySuffix = key.startsWith("effect:") ? " / Effects" : undefined;
    if (legacySuffix && resource.name === `${name}${legacySuffix}`) {
      ctx.journal.beforeResource?.(resource);
      resource.name = name;
      if (record && targetUnchanged)
        record.targetHash = fingerprint(styleSnapshot(resource));
    }
    if (
      record?.sourceHash === fingerprint(source) &&
      record.conversionHash === ctx.conversionHash &&
      (targetUnchanged || ctx.options.conflict === "preserve-local")
    ) {
      const audit = ctx.index.resourceAudits?.[sourceId(source)];
      if (audit)
        for (const p of audit.properties)
          ctx.ledger(source).mark(p.path, p.status, p.reason);
      return resource;
    }
    if (!record || fingerprint(styleSnapshot(resource)) !== record.targetHash) {
      if (ctx.options.conflict === "preserve-local") {
        ctx.finding(
          "RESOURCE_CONFLICT",
          `Local edits to style ${name} preserved.`,
          source,
          key,
          "warning",
          type === "TEXT" ? "textStyles" : "layerStyles",
        );
        return resource;
      }
    }
    // Existing resources are updated only with an explicit replacement policy. Their old definition is retained for recovery.
    ctx.journal.beforeResource?.(resource);
  } else {
    resource =
      type === "EFFECT"
        ? ctx.api.createEffectStyle()
        : ctx.api.createTextStyle();
    ctx.journal.trackResource(resource);
  }
  const ledger = ctx.ledger(source),
    checkpoint = ledger.checkpoint();
  try {
    resource.name = name;
    await apply(resource);
  } catch (error) {
    ledger.rollback(checkpoint);
    throw error;
  }
  remember(ctx, key, source, resource);
  return resource;
}
export async function importResources(ctx: ImportContext): Promise<void> {
  const doc = ctx.file.document;
  const selected = (
    source: Sketch,
    kind: ResourceKind,
    required: Set<string> | undefined,
  ) => {
    if (
      includeUnused(ctx.options, kind) ||
      !required ||
      required.has(sourceId(source))
    )
      return true;
    const ledger = ctx.ledger(source, false);
    for (const property of ledger.finalize().properties)
      ledger.mark(
        property.path,
        "Unsupported",
        "Unused source resource excluded by import options; original definition retained in document metadata.",
      );
    return false;
  };

  const d = {
    ...doc,
    do_objectID: `${ctx.file.documentId}:document`,
    _class: "document",
    name: ctx.file.name,
  };
  ctx.ledger(d);
  const swatches = [
    ...(doc.sharedSwatches?.objects ?? []),
    ...(doc.foreignSwatches ?? [])
      .map((v: Sketch) => v.localSwatch ?? v.swatch)
      .filter(Boolean),
  ].filter((sw: Sketch) =>
    selected(sw, "colors", ctx.resourceSelection?.colors),
  );
  let collection: VariableCollection | null = null;
  const cid = ctx.index.resources["color-collection"];
  if (cid)
    collection = await ctx.api.variables.getVariableCollectionByIdAsync(cid);
  if (swatches.length && !collection) {
    collection = ctx.api.variables.createVariableCollection(ctx.file.name);
    ctx.journal.trackResource(collection);
    ctx.index.resources["color-collection"] = collection.id;
  }
  if (
    collection &&
    collection.name === `${ctx.file.name.replace(/\.sketch$/i, "")} / Colors`
  ) {
    ctx.journal.beforeResource?.(collection);
    collection.name = ctx.file.name;
  }
  const colorScopes: VariableScope[] = [
    "FRAME_FILL",
    "SHAPE_FILL",
    "TEXT_FILL",
    "STROKE_COLOR",
    "EFFECT_COLOR",
  ];
  const indexedColors = new Set(
    Object.entries(ctx.index.resources)
      .filter(([key]) => key.startsWith("color:"))
      .map(([, id]) => id),
  );
  let collectionVariables: (Variable | null)[] | undefined;
  for (const sw of swatches) {
    const id = sourceId(sw),
      l = ctx.ledger(sw);
    try {
      const mapped = ctx.options.variableMap[id],
        priorId = mapped ?? ctx.index.resources[`color:${id}`];
      let v = priorId
        ? priorId.startsWith("key:")
          ? await ctx.api.variables.importVariableByKeyAsync(priorId.slice(4))
          : await ctx.api.variables.getVariableByIdAsync(priorId)
        : null;
      if (mapped && !v)
        throw new Error(
          `Explicit variable mapping ${id} was not found: ${mapped}`,
        );
      if (v && v.resolvedType !== "COLOR")
        throw new Error("Mapped variable is not COLOR.");
      // Earlier imports could create a white replacement, then skip both its
      // source value and saved ID. Recover that exact, unambiguous replacement
      // inside our collection so existing paint bindings keep the same ID.
      if (
        !v &&
        !mapped &&
        priorId &&
        collection &&
        ctx.index.resourceStates?.[`color:${id}`]
      ) {
        collectionVariables ??= await Promise.all(
          collection.variableIds.map((id) =>
            ctx.api.variables.getVariableByIdAsync(id),
          ),
        );
        const candidates = collectionVariables.filter(
          (candidate): candidate is Variable =>
            !!candidate &&
            !indexedColors.has(candidate.id) &&
            candidate.resolvedType === "COLOR" &&
            candidate.name === (sw.name ?? id) &&
            candidate.scopes.length === colorScopes.length &&
            colorScopes.every((scope) => candidate.scopes.includes(scope)),
        );
        if (
          candidates.length &&
          swatches.filter(
            (source: Sketch) =>
              (source.name ?? sourceId(source)) === (sw.name ?? id),
          ).length !== 1
        )
          throw new Error(
            `Cannot identify the replacement color variable for duplicate Sketch name ${sw.name}.`,
          );
        if (candidates.length > 1)
          throw new Error(
            `Multiple replacement color variables match ${sw.name}; the source mapping is ambiguous.`,
          );
        v = candidates[0] ?? null;
      }
      if (!v && collection) {
        v = ctx.api.variables.createVariable(
          sw.name ?? id,
          collection,
          "COLOR",
        );
        v.scopes = colorScopes;
        ctx.journal.trackResource(v);
      }
      if (!v || !collection) continue;
      if (!mapped) {
        const key = `color:${id}`;
        // Sketch owns imported colors. A stale fingerprint must never preserve
        // white defaults or prevent a recreated variable from being initialized.
        ctx.journal.beforeResource?.(v);
        v.name = sw.name ?? id;
        const c = ctx.color(sw.value ?? sw.color);
        v.setValueForMode(collection.defaultModeId, c);
        const actual = v.valuesByMode[collection.defaultModeId];
        if (
          !actual ||
          typeof actual !== "object" ||
          !("r" in actual) ||
          !(["r", "g", "b", "a"] as const).every((channel) => {
            const value =
              channel === "a" && !("a" in actual)
                ? 1
                : (actual as RGBA)[channel];
            return (
              Number.isFinite(value) && Math.abs(value - c[channel]) <= 1e-6
            );
          })
        )
          throw new Error(
            `Color variable ${v.name} does not match Sketch after assignment.`,
          );
        remember(ctx, key, sw, v);
        indexedColors.add(v.id);
      }
      ctx.resources.variables.set(id, v);
      ctx.index.resources[`color:${id}`] = v.id;
      l.fields("", ["_class", "do_objectID", "name"]);
      l.color(sw.value ? "/value" : "/color");
    } catch (e) {
      ctx.finding("VARIABLE_FAILURE", String(e), sw, "", "error");
    }
  }
  for (const shared of [
    ...(doc.layerStyles?.objects ?? []),
    ...(doc.foreignLayerStyles ?? [])
      .map((s: Sketch) => s.localSharedStyle)
      .filter(Boolean),
  ]) {
    if (!selected(shared, "layerStyles", ctx.resourceSelection?.styles))
      continue;
    const id = sourceId(shared),
      st = shared.value ?? {},
      l = ctx.ledger(shared);
    try {
      // Shared appearance stays as editable values; never invent Color Styles.
      for (const [field, target] of [
        ["fills", ctx.resources.paints],
        ["borders", ctx.resources.strokes],
      ] as const) {
        if (st[field] === undefined) continue;
        const paints: Paint[] = [];
        for (const [i, fill] of st[field].entries()) {
          const converted = await paint(
            ctx,
            shared,
            fill,
            `/value/${field}/${i}`,
          );
          if (converted) paints.push(converted);
        }
        target.set(id, paints);
      }
      if (
        st.shadows?.length ||
        st.innerShadows?.length ||
        st.blur ||
        st.blurs?.length
      ) {
        const e = await style(
          ctx,
          `effect:${id}`,
          "EFFECT",
          shared.name,
          shared,
          async (r) => {
            (r as EffectStyle).effects = await effects(
              ctx,
              shared,
              st,
              "/value",
            );
          },
        );
        ctx.resources.effects.set(id, e as EffectStyle);
      }
      l.fields(
        "",
        ["_class", "do_objectID", "name"],
        "Editable Equivalent",
        "Sketch Layer Style fills and borders retained as direct values and variable bindings; compatible effects use native effect styles.",
      );
    } catch (e) {
      ctx.finding("STYLE_FAILURE", String(e), shared, "", "error");
    }
  }
  for (const shared of [
    ...(doc.layerTextStyles?.objects ?? []),
    ...(doc.foreignTextStyles ?? [])
      .map((s: Sketch) => s.localSharedStyle)
      .filter(Boolean),
  ]) {
    if (!selected(shared, "textStyles", ctx.resourceSelection?.styles))
      continue;
    const id = sourceId(shared),
      attrs = shared.value?.textStyle?.encodedAttributes ?? {};
    try {
      const l = ctx.ledger(shared),
        base = "/value/textStyle/encodedAttributes";
      const color = attrs.MSAttributedStringColorAttribute;
      const textFills = shared.value?.fills ?? [];
      const skipColors = shared.value?.textStyle?.skipColors === true;
      if (!skipColors && (textFills.length || color)) {
        const paints: Paint[] = [];
        if (textFills.length) {
          for (const [i, f] of textFills.entries()) {
            const converted = await paint(ctx, shared, f, `/value/fills/${i}`);
            if (converted) paints.push(converted);
          }
        } else
          paints.push(
            solidPaint(
              ctx,
              shared,
              color,
              `${base}/MSAttributedStringColorAttribute`,
            ),
          );
        ctx.resources.paints.set(id, paints);
      }
      const t = await style(
        ctx,
        `text:${id}`,
        "TEXT",
        shared.name,
        shared,
        async (r) => {
          const text = r as TextStyle,
            descriptor = attrs.MSAttributedStringFontAttribute;
          text.fontName = await resolveFont(
            ctx,
            descriptor,
            shared,
            "/value/textStyle/encodedAttributes/MSAttributedStringFontAttribute",
          );
          text.fontSize = Math.max(1, descriptor?.attributes?.size ?? 12);
          text.letterSpacing = { unit: "PIXELS", value: attrs.kerning ?? 0 };
          const p = attrs.paragraphStyle ?? {};
          const height = p.maximumLineHeight || p.minimumLineHeight;
          text.lineHeight =
            height > 0 ? { unit: "PIXELS", value: height } : { unit: "AUTO" };
          text.paragraphIndent = p.firstLineHeadIndent ?? 0;
          text.textDecoration =
            attrs.underlineStyle === 1
              ? "UNDERLINE"
              : attrs.strikethroughStyle === 1
                ? "STRIKETHROUGH"
                : "NONE";
          l.mark(`${base}/MSAttributedStringFontAttribute/attributes/size`);
          l.fields(base, [
            "kerning",
            "MSAttributedStringTextTransformAttribute",
            "underlineStyle",
            "strikethroughStyle",
          ]);
          l.fields(`${base}/paragraphStyle`, [
            "_class",
            "paragraphSpacing",
            "firstLineHeadIndent",
          ]);
          l.fields(
            `${base}/paragraphStyle`,
            ["minimumLineHeight", "maximumLineHeight"],
            p.minimumLineHeight === p.maximumLineHeight ? "Native" : "Partial",
            "One Figma line height represents Sketch minimum/maximum line height.",
          );
          text.paragraphSpacing = p.paragraphSpacing ?? 0;
          text.textCase =
            (["ORIGINAL", "UPPER", "LOWER"] as const)[
              attrs.MSAttributedStringTextTransformAttribute ?? 0
            ] ?? "ORIGINAL";
        },
      );
      ctx.resources.texts.set(id, t as TextStyle);
      ctx
        .ledger(shared)
        .mark(
          "/value/textStyle/skipColors",
          "Native",
          skipColors
            ? "Source partial Text Style excludes colors."
            : "Source colors retained directly on text with original variable bindings.",
        );
      if (shared.value?.textStyle?.skipAlignment !== undefined)
        ctx
          .ledger(shared)
          .mark(
            "/value/textStyle/skipAlignment",
            "Partial",
            "Figma Text Styles exclude alignment. Source layer alignment is applied independently and original style ownership is retained.",
          );
      ctx
        .ledger(shared)
        .fields(
          "",
          ["_class", "do_objectID", "name"],
          color || textFills.length ? "Editable Equivalent" : "Native",
          color || textFills.length
            ? "Original Text Style retained; colors applied directly on text without additional styles."
            : undefined,
        );
    } catch (e) {
      ctx.finding("TEXT_STYLE_FAILURE", String(e), shared, "", "error");
    }
  }
  for (const asset of doc.assets?.gradientAssets ?? []) {
    if (!selected(asset, "colors", ctx.resourceSelection?.styles)) continue;
    try {
      const converted = await paint(
        ctx,
        asset,
        { fillType: 1, gradient: asset.gradient },
        "/gradientAsset",
      );
      if (converted) ctx.resources.paints.set(sourceId(asset), [converted]);
    } catch (e) {
      ctx.finding("GRADIENT_STYLE", String(e), asset);
    }
  }
  if (ctx.options.tokens) await importTokens(ctx, ctx.options.tokens);
  ctx.index.resourceAudits ??= {};
  for (const [id, ledger] of ctx.ledgers)
    ctx.index.resourceAudits[id] = ledger.finalize();
}
export function validateTokens(value: unknown): TokenFile {
  const t = value as TokenFile;
  if (
    !t ||
    typeof t.collection !== "string" ||
    !Array.isArray(t.modes) ||
    !t.modes.length ||
    !t.modes.every((m) => typeof m === "string") ||
    new Set(t.modes).size !== t.modes.length ||
    !Array.isArray(t.tokens)
  )
    throw new Error(
      "Token JSON requires collection, unique modes[], and tokens[].",
    );
  if (
    t.bindings !== undefined &&
    (!Array.isArray(t.bindings) ||
      !t.bindings.every(
        (b) =>
          b &&
          typeof b.sourceId === "string" &&
          typeof b.field === "string" &&
          typeof b.token === "string",
      ))
  )
    throw new Error(
      "Token bindings require sourceId, field, and token strings.",
    );
  const boundFields = new Set<string>();
  for (const b of t.bindings ?? []) {
    const key = `${b.sourceId}:${b.field}`;
    if (boundFields.has(key)) throw new Error(`Duplicate token binding ${key}`);
    boundFields.add(key);
  }
  const names = new Set<string>();
  for (const token of t.tokens) {
    if (
      typeof token.name !== "string" ||
      names.has(token.name) ||
      !["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(token.type) ||
      !token.values
    )
      throw new Error("Invalid or duplicate token.");
    names.add(token.name);
    for (const mode of t.modes) {
      const value = token.values[mode];
      if (value === undefined)
        throw new Error(`Missing ${mode} value for ${token.name}`);
      if (typeof value === "string" && /^\{.+\}$/.test(value)) continue;
      const valid =
        token.type === "FLOAT"
          ? typeof value === "number" && Number.isFinite(value)
          : token.type === "BOOLEAN"
            ? typeof value === "boolean"
            : token.type === "STRING"
              ? typeof value === "string"
              : !!value &&
                typeof value === "object" &&
                ["r", "g", "b"].every(
                  (k) =>
                    typeof (value as any)[k] === "number" &&
                    (value as any)[k] >= 0 &&
                    (value as any)[k] <= 1,
                ) &&
                ((value as any).a === undefined ||
                  (typeof (value as any).a === "number" &&
                    (value as any).a >= 0 &&
                    (value as any).a <= 1));
      if (!valid)
        throw new Error(
          `Invalid ${token.type} value for ${token.name}/${mode}`,
        );
    }
  }
  return t;
}
function tokenScopes(
  tokens: TokenFile,
  name: string,
  type: VariableResolvedDataType,
): VariableScope[] {
  const fields = (tokens.bindings ?? [])
    .filter((b) => b.token === name)
    .map((b) => b.field);
  const scope = (field: string): VariableScope =>
    /Radius$|^cornerRadius$/.test(field)
      ? "CORNER_RADIUS"
      : /^(min|max)?(Width|Height)$|^(width|height)$/.test(field)
        ? "WIDTH_HEIGHT"
        : /padding|Spacing$|Gap$/.test(field)
          ? field === "letterSpacing"
            ? "LETTER_SPACING"
            : field === "paragraphSpacing"
              ? "PARAGRAPH_SPACING"
              : "GAP"
          : field === "fontFamily"
            ? "FONT_FAMILY"
            : field === "fontStyle"
              ? "FONT_STYLE"
              : field === "fontSize"
                ? "FONT_SIZE"
                : field === "fontWeight"
                  ? "FONT_WEIGHT"
                  : field === "lineHeight"
                    ? "LINE_HEIGHT"
                    : field === "paragraphIndent"
                      ? "PARAGRAPH_INDENT"
                      : field === "characters"
                        ? "TEXT_CONTENT"
                        : field === "opacity"
                          ? "OPACITY"
                          : /^stroke/.test(field)
                            ? "STROKE_FLOAT"
                            : "ALL_SCOPES";
  if (type === "COLOR")
    return [
      "FRAME_FILL",
      "SHAPE_FILL",
      "TEXT_FILL",
      "STROKE_COLOR",
      "EFFECT_COLOR",
    ];
  return fields.length ? [...new Set(fields.map(scope))] : ["ALL_SCOPES"];
}
async function preloadTokenFontValues(
  ctx: ImportContext,
  tokens: TokenFile,
): Promise<void> {
  const read = (name: string, seen = new Set<string>()): string[] => {
    if (seen.has(name)) return [];
    seen.add(name);
    return Object.values(
      tokens.tokens.find((t) => t.name === name)?.values ?? {},
    ).flatMap((v) =>
      typeof v !== "string"
        ? []
        : /^\{.+\}$/.test(v)
          ? read(v.slice(1, -1), seen)
          : [v],
    );
  };
  const needed = new Map<string, FontName>();
  for (const b of tokens.bindings ?? [])
    if (b.field === "fontFamily" || b.field === "fontStyle")
      for (const value of read(b.token))
        for (const font of ctx.fonts)
          if (
            b.field === "fontFamily"
              ? font.fontName.family === value
              : font.fontName.style === value
          )
            needed.set(JSON.stringify(font.fontName), font.fontName);
  for (const font of needed.values()) await ctx.api.loadFontAsync(font);
}
async function importTokens(
  ctx: ImportContext,
  input: TokenFile,
): Promise<void> {
  const tokens = validateTokens(input),
    key = `tokens:${tokens.collection}`;
  const selectedTokens = tokens.tokens.filter(
    (token) =>
      !ctx.resourceSelection ||
      ctx.resourceSelection.tokenNames.has(token.name),
  );
  const tokenSource: Sketch = {
    ...tokens,
    _class: "tokenFile",
    do_objectID: `${ctx.file.documentId}:tokens`,
    name: tokens.collection,
  };
  const ledger = ctx.ledger(tokenSource, selectedTokens.length > 0);
  if (!selectedTokens.length) {
    for (const property of ledger.finalize().properties)
      ledger.mark(
        property.path,
        "Unsupported",
        "Unused supplied token excluded by import options; original definition retained.",
      );
    return;
  }
  for (const [i, token] of tokens.tokens.entries())
    if (
      !ctx.resourceSelection?.tokenNames.has(token.name) &&
      ctx.resourceSelection
    )
      for (const property of ledger.finalize().properties)
        if (property.path.startsWith(`/tokens/${i}/`))
          ledger.mark(
            property.path,
            "Unsupported",
            "Unused supplied token excluded by import options; original definition retained.",
          );
  ledger.fields("", ["_class", "do_objectID", "name", "collection"]);
  let collection: VariableCollection | null = null;
  const id = ctx.index.resources[key];
  if (id)
    collection = await ctx.api.variables.getVariableCollectionByIdAsync(id);
  if (!collection) {
    collection = ctx.api.variables.createVariableCollection(tokens.collection);
    ctx.journal.trackResource(collection);
    ctx.index.resources[key] = collection.id;
  }
  ctx.journal.beforeResource?.(collection);
  const modes = new Map(collection.modes.map((m) => [m.name, m.modeId]));
  if (!modes.has(tokens.modes[0]) && collection.modes.length === 1) {
    collection.renameMode(collection.defaultModeId, tokens.modes[0]);
    modes.set(tokens.modes[0], collection.defaultModeId);
  }
  for (const name of tokens.modes)
    if (!modes.has(name)) {
      try {
        modes.set(name, collection.addMode(name));
      } catch (e) {
        ctx.finding(
          "VARIABLE_MODE_LIMIT",
          `${name}: ${e}`,
          undefined,
          key,
          "error",
        );
      }
    }
  for (const [i, name] of tokens.modes.entries())
    if (modes.has(name)) ledger.mark(`/modes/${i}`);
  const variables = new Map<string, Variable>(),
    preserved = new Set<string>();
  for (const token of selectedTokens) {
    let v: Variable | null = null;
    const explicit = ctx.options.variableMap[token.name],
      prior = explicit ?? ctx.index.resources[`${key}:${token.name}`];
    if (prior)
      v = prior.startsWith("key:")
        ? await ctx.api.variables.importVariableByKeyAsync(prior.slice(4))
        : await ctx.api.variables.getVariableByIdAsync(prior);
    if (explicit && !v)
      throw new Error(
        `Explicit token mapping ${token.name} was not found: ${explicit}`,
      );
    if (v && v.resolvedType !== token.type)
      throw new Error(`Token type mismatch ${token.name}`);
    if (!v) {
      v = ctx.api.variables.createVariable(token.name, collection, token.type);
      v.scopes = tokenScopes(tokens, token.name, token.type);
      ctx.journal.trackResource(v);
    } else {
      const record = ctx.index.resourceStates?.[`${key}:${token.name}`];
      if (
        explicit ||
        (ctx.options.conflict === "preserve-local" &&
          (!record ||
            fingerprint({ name: v.name, valuesByMode: v.valuesByMode }) !==
              record.targetHash))
      ) {
        preserved.add(token.name);
        ctx.finding(
          explicit ? "TOKEN_MAPPING" : "RESOURCE_CONFLICT",
          `Existing token ${token.name} retained.`,
          undefined,
          `${key}:${token.name}`,
        );
      } else ctx.journal.beforeResource?.(v);
    }
    variables.set(token.name, v);
    ctx.index.resources[`${key}:${token.name}`] = v.id;
    ctx.resources.variables.set(token.name, v);
    const i = tokens.tokens.indexOf(token);
    ledger.fields(`/tokens/${i}`, ["name", "type"]);
  }
  // Figma may update already-bound text during setValueForMode, so preload new font values first.
  await preloadTokenFontValues(ctx, tokens);
  const visiting = new Set<string>(),
    done = new Set<string>();
  const apply = (name: string) => {
    if (done.has(name)) return;
    if (preserved.has(name)) {
      const token = tokens.tokens.find((t) => t.name === name)!;
      for (const mode of tokens.modes) {
        const path = `/tokens/${tokens.tokens.indexOf(token)}/values/${escapePointer(mode)}`,
          value = token.values[mode];
        if (value && typeof value === "object")
          ledger.fields(
            path,
            Object.keys(value),
            "Partial",
            "Explicit mapping or preserved local value takes precedence.",
          );
        else
          ledger.mark(
            path,
            "Partial",
            "Explicit mapping or preserved local value takes precedence.",
          );
      }
      return;
    }
    if (visiting.has(name)) throw new Error(`Circular token alias ${name}`);
    visiting.add(name);
    const token = tokens.tokens.find((t) => t.name === name)!;
    const variable = variables.get(name)!;
    for (const mode of tokens.modes) {
      const modeId = modes.get(mode);
      if (!modeId) continue;
      const value = token.values[mode];
      const path = `/tokens/${tokens.tokens.indexOf(token)}/values/${escapePointer(mode)}`;
      if (typeof value === "string" && /^\{.+\}$/.test(value)) {
        const target = value.slice(1, -1),
          alias = variables.get(target);
        if (!alias || alias.resolvedType !== token.type) {
          ctx.finding(
            "TOKEN_ALIAS",
            `Missing or incompatible token alias ${target}.`,
            undefined,
            `${name}/${mode}`,
            "error",
          );
          continue;
        }
        apply(target);
        variable.setValueForMode(
          modeId,
          ctx.api.variables.createVariableAlias(alias),
        );
        ledger.mark(path);
      } else {
        try {
          variable.setValueForMode(modeId, value);
          if (value && typeof value === "object")
            ledger.fields(path, Object.keys(value));
          else ledger.mark(path);
        } catch (e) {
          ctx.finding(
            "TOKEN_VALUE",
            `${name}/${mode}: ${e}`,
            undefined,
            key,
            "error",
          );
        }
      }
    }
    remember(ctx, `${key}:${name}`, token, variable);
    visiting.delete(name);
    done.add(name);
  };
  for (const token of selectedTokens)
    try {
      apply(token.name);
    } catch (e) {
      ctx.finding("TOKEN_CYCLE", String(e), undefined, key, "error");
    }
}
export async function bindStyles(
  ctx: ImportContext,
  s: Sketch,
  node: SceneNode,
): Promise<void> {
  const id = s.sharedStyleID;
  if (!id) return;
  const paint = ctx.resources.paints.get(id),
    stroke = ctx.resources.strokes.get(id),
    effect = ctx.resources.effects.get(id),
    text = ctx.resources.texts.get(id);
  let bound = false,
    overridden = false;
  const override = (field: string) => {
    overridden = true;
    ctx.finding(
      "LOCAL_STYLE_OVERRIDE",
      `${s.name}: source ${field} overrides the shared style. Editable source values retained; Figma cannot bind that overridden resource as a whole.`,
      s,
      "/sharedStyleID",
      "warning",
      "layerStyles",
    );
  };
  try {
    if (paint && "fills" in node) {
      // Layer-local values take precedence over shared defaults.
      if (
        s.style?.fills === undefined ||
        (node.type === "TEXT" && !s.style.fills.length)
      )
        node.fills = paint;
      bound = true;
    }
    if (stroke && "strokes" in node) {
      if (s.style?.borders === undefined) node.strokes = stroke;
      bound = true;
    }
    if (effect && "setEffectStyleIdAsync" in node) {
      if (
        s.style &&
        "effects" in node &&
        !sameValue(node.effects, effect.effects)
      )
        override("effects");
      else {
        await node.setEffectStyleIdAsync(effect.id);
        bound = true;
      }
    }
    if (text && node.type === "TEXT") {
      await node.setTextStyleIdAsync(text.id);
      bound = true;
    }
    if (bound || overridden)
      ctx
        .ledger(s)
        .mark(
          "/sharedStyleID",
          overridden || paint || stroke ? "Partial" : "Native",
          overridden
            ? "Explicit source appearance overrides retained; conflicting style parts cannot remain bound."
            : paint || stroke
              ? "Source colors retained as direct paints and variable bindings; original shared style identity retained in metadata."
              : undefined,
        );
    else
      ctx.finding(
        "STYLE_REFERENCE",
        `Unresolved shared style ${id}.`,
        s,
        "/sharedStyleID",
      );
  } catch (e) {
    ctx.finding("STYLE_BINDING", String(e), s, "/sharedStyleID", "error");
  }
}

/** Old generated styles are removed only after commit, when unchanged and unused anywhere. */
export async function removeUnusedGeneratedStyles(
  ctx: ImportContext,
): Promise<void> {
  const legacy = Object.entries(ctx.index.resources).filter(([key]) =>
    /^(paint:|stroke:|gradient:|text-override:)/.test(key),
  );
  if (!legacy.length) return;
  const used = new Set<string>();
  for (const page of ctx.api.root.children) {
    for (const node of page.findAll(() => true)) {
      for (const field of [
        "fillStyleId",
        "strokeStyleId",
        "textStyleId",
      ] as const) {
        const value = (node as unknown as Sketch)[field];
        if (typeof value === "string" && value) used.add(value);
      }
      if (
        (node.type === "TEXT" || node.type === "TEXT_PATH") &&
        node.characters.length
      )
        for (const range of node.getStyledTextSegments([
          "fillStyleId",
          "textStyleId",
        ])) {
          if (range.fillStyleId) used.add(range.fillStyleId);
          if (range.textStyleId) used.add(range.textStyleId);
        }
    }
  }
  for (const [key, id] of legacy) {
    const style = await ctx.api.getStyleByIdAsync(id);
    const record = ctx.index.resourceStates?.[key];
    const snapshot =
      style?.type === "TEXT"
        ? { name: style.name, ...textStyleValues(style) }
        : style
          ? styleSnapshot(style)
          : null;
    if (
      style &&
      (ctx.options.styleMap[key] ||
        !record ||
        used.has(id) ||
        fingerprint(snapshot) !== record.targetHash)
    ) {
      ctx.finding(
        "LEGACY_STYLE_RETAINED",
        `${style.name}: an older generated style is still referenced, mapped, or locally edited; retained to protect existing work.`,
        undefined,
        key,
        "warning",
        style.type === "TEXT" ? "textStyles" : "layerStyles",
      );
      continue;
    }
    style?.remove();
    delete ctx.index.resources[key];
    if (ctx.index.resourceStates) delete ctx.index.resourceStates[key];
  }
}
