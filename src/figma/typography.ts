import { reconcileTextStyleBindings } from "./text-style-bindings";
import { sameFont, samePaints, sameValue } from "./property-equality";
export { sameFont, samePaints, sameValue } from "./property-equality";
import { solidPaint } from "./appearance";
import { finite, fingerprint } from "../core/math";
import type { Sketch } from "../core/types";
import type { ImportContext } from "./context";
export const normalizeFont = (name: string) =>
  name.replace(/[^a-z0-9]/gi, "").toLowerCase();
// PostScript names documented by the installed Arial font name table.
const postscriptAliases: Record<string, FontName> = {
  ArialMT: { family: "Arial", style: "Regular" },
  "Arial-BoldMT": { family: "Arial", style: "Bold" },
  "Arial-ItalicMT": { family: "Arial", style: "Italic" },
  "Arial-BoldItalicMT": { family: "Arial", style: "Bold Italic" },
};
export function matchFont(name: string, fonts: Font[]): FontName | undefined {
  const alias = postscriptAliases[name];
  if (alias)
    return fonts.find(
      (f) =>
        normalizeFont(f.fontName.family + f.fontName.style) ===
        normalizeFont(alias.family + alias.style),
    )?.fontName;
  const n = normalizeFont(name);
  return (
    fonts.find((f) => normalizeFont(f.fontName.family + f.fontName.style) === n)
      ?.fontName ??
    fonts.find(
      (f) =>
        normalizeFont(f.fontName.family) === n &&
        f.fontName.style === "Regular",
    )?.fontName
  );
}
export async function resolveFont(
  ctx: ImportContext,
  descriptor: Sketch,
  s: Sketch,
  path: string,
): Promise<FontName> {
  const name = descriptor?.attributes?.name ?? "Inter-Regular",
    replacement = ctx.options.fontMap[name];
  let font: FontName | undefined = replacement ?? matchFont(name, ctx.fonts);
  let replaced = !!replacement;
  if (!font) {
    font = ctx.options.fallbackFont;
    replaced = true;
    if (!font)
      throw new Error(
        `Missing font ${name}. Choose a replacement before import.`,
      );
  }
  const variations = descriptor?.attributes?.variation;
  if (variations) {
    const axes = ctx.api.getFontFamilyVariationAxes(font.family),
      settings: Record<string, number> = {};
    for (const [key, value] of Object.entries(variations)) {
      const n = Number(key),
        tag = Number.isFinite(n)
          ? String.fromCharCode(
              (n >>> 24) & 255,
              (n >>> 16) & 255,
              (n >>> 8) & 255,
              n & 255,
            )
          : key;
      if (axes?.includes(tag) && typeof value === "number") {
        settings[tag] = value;
        ctx.ledger(s).mark(`${path}/attributes/variation/${key}`);
      } else
        ctx.finding(
          "FONT_AXIS",
          `Variable font axis ${tag} is unavailable in ${font.family}.`,
          s,
          `${path}/attributes/variation/${key}`,
        );
    }
    font = {
      ...font,
      ...(Object.keys(settings).length ? { variationSettings: settings } : {}),
    };
  }
  await ctx.api.loadFontAsync(font);
  ctx.ledger(s).fields(path, ["_class"], replaced ? "Partial" : "Native");
  ctx
    .ledger(s)
    .mark(
      `${path}/attributes/name`,
      replaced ? "Partial" : "Native",
      replaced
        ? `Replaced ${name} with ${font.family} ${font.style}.`
        : "Matched available Figma font.",
    );
  if (replaced)
    ctx.finding(
      "FONT_REPLACED",
      `${name} → ${font.family} ${font.style}`,
      s,
      path,
    );
  return font;
}
const equal = (a: unknown, b: unknown) =>
  typeof a !== "symbol" && fingerprint(a) === fingerprint(b);
function rangeValue(
  node: TextNode | TextPathNode,
  getter: string,
  setter: string,
  a: number,
  b: number,
  value: unknown,
) {
  const target = node as unknown as Record<string, Function>;
  const before = target[getter]?.(a, b);
  // Variable fonts read back every axis, while omitted input axes mean the named
  // style defaults. Reassigning an identical named style detaches text styles.
  const same =
    getter === "getRangeFontName"
      ? sameFont(before, value as FontName)
      : sameValue(before, value);
  if (!target[getter] || !same) {
    target[setter](a, b, value);
  }
}
async function applyRange(
  ctx: ImportContext,
  s: Sketch,
  node: TextNode | TextPathNode,
  attrs: Sketch,
  a: number,
  b: number,
  path: string,
): Promise<void> {
  const l = ctx.ledger(s);
  if (b <= a) return;
  const font = attrs.MSAttributedStringFontAttribute;
  if (font) {
    rangeValue(
      node,
      "getRangeFontName",
      "setRangeFontName",
      a,
      b,
      await resolveFont(
        ctx,
        font,
        s,
        `${path}/MSAttributedStringFontAttribute`,
      ),
    );
    if (typeof font.attributes?.size === "number") {
      rangeValue(
        node,
        "getRangeFontSize",
        "setRangeFontSize",
        a,
        b,
        Math.max(1, font.attributes.size),
      );
      l.mark(`${path}/MSAttributedStringFontAttribute/attributes/size`);
    }
  }
  const color = attrs.MSAttributedStringColorAttribute;
  if (color) {
    // A Sketch text fill (for example a gradient) takes precedence over its
    // fallback attributed color. Distinct run colors remain explicit overrides.
    const baseColor =
      s.style?.textStyle?.encodedAttributes?.MSAttributedStringColorAttribute;
    if (
      !(s.style?.fills ?? []).some((f: Sketch) => f.isEnabled !== false) ||
      JSON.stringify(color) !== JSON.stringify(baseColor)
    ) {
      const fills = [
        solidPaint(ctx, s, color, `${path}/MSAttributedStringColorAttribute`),
      ];
      if (!samePaints(node.getRangeFills(a, b), fills))
        node.setRangeFills(a, b, fills);
    } else
      l.color(
        `${path}/MSAttributedStringColorAttribute`,
        "Partial",
        "Attributed fallback color retained; active text fills define appearance.",
      );
  }
  if (typeof attrs.kerning === "number") {
    rangeValue(node, "getRangeLetterSpacing", "setRangeLetterSpacing", a, b, {
      unit: "PIXELS",
      value: attrs.kerning,
    });
    l.mark(
      `${path}/kerning`,
      "Partial",
      "Editable letter spacing; Sketch pair kerning and font shaping may differ.",
    );
  }
  const underline = attrs.underlineStyle === 1,
    strike = attrs.strikethroughStyle === 1;
  if (
    underline ||
    strike ||
    attrs.underlineStyle === 0 ||
    attrs.strikethroughStyle === 0
  ) {
    if ("setRangeTextDecoration" in node)
      rangeValue(
        node,
        "getRangeTextDecoration",
        "setRangeTextDecoration",
        a,
        b,
        underline ? "UNDERLINE" : strike ? "STRIKETHROUGH" : "NONE",
      );
    l.fields(
      path,
      ["underlineStyle", "strikethroughStyle"],
      underline && strike ? "Partial" : "Native",
      underline && strike
        ? "Figma supports one textDecoration; underline retained, strikethrough metadata preserved."
        : undefined,
    );
  }
  if (attrs.MSAttributedStringTextTransformAttribute !== undefined) {
    rangeValue(
      node,
      "getRangeTextCase",
      "setRangeTextCase",
      a,
      b,
      (["ORIGINAL", "UPPER", "LOWER"] as const)[
        attrs.MSAttributedStringTextTransformAttribute
      ] ?? "ORIGINAL",
    );
    l.mark(`${path}/MSAttributedStringTextTransformAttribute`);
  }
  if ("textAlignHorizontal" in node && attrs.paragraphStyle) {
    const p = attrs.paragraphStyle,
      base = `${path}/paragraphStyle`;
    if (p.alignment !== undefined) {
      node.textAlignHorizontal =
        (["LEFT", "RIGHT", "CENTER", "JUSTIFIED", "LEFT"] as const)[
          p.alignment
        ] ?? "LEFT";
      l.mark(
        `${base}/alignment`,
        p.alignment === 4 ? "Partial" : "Native",
        "Paragraph alignment applies to the text box; Natural alignment depends on writing direction.",
      );
    }
    const line = p.maximumLineHeight ?? p.minimumLineHeight;
    if (line > 0 && "setRangeLineHeight" in node) {
      rangeValue(node, "getRangeLineHeight", "setRangeLineHeight", a, b, {
        unit: "PIXELS",
        value: line,
      });
      l.fields(
        base,
        ["minimumLineHeight", "maximumLineHeight"],
        "Partial",
        "One native line height; distinct minimum and maximum are retained in metadata.",
      );
    } else if ("setRangeLineHeight" in node)
      rangeValue(node, "getRangeLineHeight", "setRangeLineHeight", a, b, {
        unit: "AUTO",
      });
    if (node.type === "TEXT") {
      if (p.paragraphSpacing !== undefined) {
        rangeValue(
          node,
          "getRangeParagraphSpacing",
          "setRangeParagraphSpacing",
          a,
          b,
          p.paragraphSpacing,
        );
        l.mark(`${base}/paragraphSpacing`);
      }
      if (p.firstLineHeadIndent !== undefined) {
        rangeValue(
          node,
          "getRangeParagraphIndent",
          "setRangeParagraphIndent",
          a,
          b,
          p.firstLineHeadIndent,
        );
        l.mark(
          `${base}/firstLineHeadIndent`,
          "Partial",
          "Figma paragraph indent; precise head/tail indentation remains metadata.",
        );
      }
    }
    l.mark(`${base}/_class`);
  }
}
export async function applyText(
  ctx: ImportContext,
  s: Sketch,
  node: TextNode | TextPathNode,
  bindBaseStyle?: () => Promise<void>,
): Promise<void> {
  const l = ctx.ledger(s),
    text = s.attributedString?.string ?? "",
    base = s.style?.textStyle?.encodedAttributes ?? {},
    descriptor =
      base.MSAttributedStringFontAttribute ??
      s.attributedString?.attributes?.[0]?.attributes
        ?.MSAttributedStringFontAttribute;
  await loadCurrentFonts(ctx, node);
  await bindBaseStyle?.();
  const sourceStyle =
    node.type === "TEXT" && ctx.resources.texts.get(s.sharedStyleID);
  if (!sourceStyle) {
    const font = await resolveFont(
      ctx,
      descriptor,
      s,
      "/style/textStyle/encodedAttributes/MSAttributedStringFontAttribute",
    );
    if (!sameFont(node.fontName, font)) node.fontName = font;
  }
  if (node.characters !== text) node.characters = text;
  l.fields("/attributedString", ["_class", "string"]);
  await applyRange(
    ctx,
    s,
    node,
    base,
    0,
    text.length,
    "/style/textStyle/encodedAttributes",
  );
  for (const [i, r] of (s.attributedString?.attributes ?? []).entries()) {
    const a = r.location,
      b = a + r.length,
      path = `/attributedString/attributes/${i}`;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b > text.length ||
      b < a
    ) {
      ctx.finding(
        "TEXT_RANGE",
        "Invalid UTF-16 rich text range.",
        s,
        path,
        "error",
      );
      continue;
    }
    await applyRange(
      ctx,
      s,
      node,
      r.attributes ?? {},
      a,
      b,
      `${path}/attributes`,
    );
    l.fields(path, ["_class", "location", "length"]);
  }
  node.textAlignVertical =
    (["TOP", "CENTER", "BOTTOM"] as const)[
      s.style?.textStyle?.verticalAlignment ?? 0
    ] ?? "TOP";
  l.fields("/style/textStyle", ["_class", "verticalAlignment"]);
  if (node.type === "TEXT") {
    const w = Math.max(0.01, finite(s.frame?.width, 1)),
      h = Math.max(0.01, finite(s.frame?.height, 1));
    node.textAutoResize = "NONE";
    node.resize(w, h);
    node.textAutoResize =
      (["WIDTH_AND_HEIGHT", "HEIGHT", "NONE"] as const)[
        s.textBehaviour ??
          (s.horizontalSizing === 1 ? 0 : s.verticalSizing === 1 ? 1 : 2)
      ] ?? "NONE";
    l.mark(
      "/textBehaviour",
      "Partial",
      "Native text sizing; glyph metrics and line breaks require source-render comparison.",
    );
  }
  if (node.type === "TEXT") await reconcileTextStyleBindings(ctx, s, node);
  node.name = s.name ?? text;
}
/** New and empty text nodes have a font but no valid character range. */
export function currentFontNames(node: TextNode | TextPathNode): FontName[] {
  if (node.characters.length)
    return node.getRangeAllFontNames(0, node.characters.length);
  return typeof node.fontName === "symbol" ? [] : [node.fontName];
}
export async function loadCurrentFonts(
  ctx: ImportContext,
  node: TextNode | TextPathNode,
): Promise<void> {
  for (const font of currentFontNames(node)) await ctx.api.loadFontAsync(font);
  if (node.characters.length && typeof node.fontName !== "symbol")
    await ctx.api.loadFontAsync(node.fontName);
}
