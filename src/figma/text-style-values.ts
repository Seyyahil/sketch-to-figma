import type { ImportContext } from "./context";
import { sameFont, sameValue } from "./property-equality";

export const textRangeFields = [
  "fontName",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "textCase",
  "textDecoration",
  "paragraphIndent",
  "paragraphSpacing",
  "listSpacing",
  "textWrapStyle",
] as const;
export const textNodeFields = [
  "leadingTrim",
  "hangingPunctuation",
  "hangingList",
] as const;
export const textVariableFields: readonly VariableBindableTextField[] = [
  "fontFamily",
  "fontStyle",
  "fontWeight",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "paragraphIndent",
  "paragraphSpacing",
];
export type TextStyleValues = Pick<
  TextStyle,
  | (typeof textRangeFields)[number]
  | (typeof textNodeFields)[number]
  | "boundVariables"
>;
export type TextRange = Pick<
  StyledTextSegment,
  | (typeof textRangeFields)[number]
  | "boundVariables"
  | "start"
  | "end"
  | "textStyleId"
>;
export function textStyleValues(style: TextStyle | TextNode): TextStyleValues {
  return Object.fromEntries([
    ...[...textRangeFields, ...textNodeFields].map((key) => [key, style[key]]),
    [
      "boundVariables",
      Object.fromEntries(
        textVariableFields
          .filter((field) => style.boundVariables?.[field])
          .map((field) => [field, style.boundVariables![field]]),
      ),
    ],
  ]) as TextStyleValues;
}
export function textRangeValues(
  node: TextNode,
  range: TextRange,
): TextStyleValues {
  return Object.fromEntries([
    ...textRangeFields.map((key) => [key, range[key]]),
    ...textNodeFields.map((key) => [key, node[key]]),
    [
      "boundVariables",
      Object.fromEntries(
        textVariableFields
          .filter((field) => range.boundVariables?.[field])
          .map((field) => [field, range.boundVariables![field]]),
      ),
    ],
  ]) as TextStyleValues;
}
export function textStyleDifferences(
  a: TextStyleValues,
  b: TextStyleValues,
): string[] {
  const differences: string[] = [];
  for (const field of [...textRangeFields, ...textNodeFields])
    if (
      !(field === "fontName"
        ? sameFont(a.fontName, b.fontName)
        : sameValue(a[field], b[field]))
    )
      differences.push(field);
  for (const field of textVariableFields)
    if (!sameValue(a.boundVariables?.[field], b.boundVariables?.[field]))
      differences.push(`boundVariables.${field}`);
  return differences;
}
export function textRanges(node: TextNode) {
  return node.getStyledTextSegments([
    ...textRangeFields,
    "boundVariables",
    "textStyleId",
    "fillStyleId",
    "fills",
  ]);
}
export function rangeMatches(
  node: TextNode,
  start: number,
  end: number,
  expected: TextStyleValues,
): boolean {
  if (!node.characters.length)
    return textStyleDifferences(textStyleValues(node), expected).length === 0;
  const ranges = textRanges(node).filter(
    (range) => range.start < end && range.end > start,
  );
  return (
    ranges.length > 0 &&
    ranges.every(
      (range) =>
        textStyleDifferences(textRangeValues(node, range), expected).length ===
        0,
    )
  );
}

/** Restore exact values after a host rejects a style/override combination. */
export async function restoreTextRange(
  ctx: ImportContext,
  node: TextNode,
  start: number,
  end: number,
  values: TextStyleValues,
): Promise<void> {
  await ctx.api.loadFontAsync(values.fontName);
  const methods = node as unknown as Record<
    string,
    (start: number, end: number, value?: unknown) => unknown
  >;
  for (const field of textRangeFields) {
    const suffix = field[0].toUpperCase() + field.slice(1);
    const current = node.characters.length
      ? methods[`getRange${suffix}`].call(node, start, end)
      : node[field];
    const equal =
      field === "fontName"
        ? sameFont(current as FontName | symbol, values.fontName)
        : sameValue(current, values[field]);
    if (!equal) {
      if (node.characters.length)
        methods[`setRange${suffix}`].call(node, start, end, values[field]);
      else (node as unknown as Record<string, unknown>)[field] = values[field];
    }
  }
  for (const field of textNodeFields)
    if (!sameValue(node[field], values[field]))
      (node as unknown as Record<string, unknown>)[field] = values[field];
  for (const field of textVariableFields) {
    const alias = values.boundVariables?.[field];
    if (
      sameValue(
        (node.characters.length
          ? node.getRangeBoundVariable(start, end, field)
          : node.boundVariables?.[field]) ?? undefined,
        alias,
      )
    )
      continue;
    const variable = alias
      ? await ctx.api.variables.getVariableByIdAsync(alias.id)
      : null;
    if (alias && !variable)
      throw new Error(`Missing typography variable ${alias.id}.`);
    if (node.characters.length)
      node.setRangeBoundVariable(start, end, field, variable);
    else node.setBoundVariable(field, variable);
  }
}
