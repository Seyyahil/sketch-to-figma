import type { ImportContext } from "./context";
import { currentFontNames, loadCurrentFonts } from "./typography";
import { readData, writeData } from "./storage";
import { type Sketch } from "../core/types";
const numeric = new Set<VariableBindableNodeField | VariableBindableTextField>([
  "height",
  "width",
  "itemSpacing",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "counterAxisSpacing",
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "opacity",
  "gridRowGap",
  "gridColumnGap",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent",
]);
const strings = new Set(["characters", "fontFamily", "fontStyle"]);
export const TEXT_TOKEN_FIELDS = new Set<VariableBindableTextField>([
  "fontFamily",
  "fontStyle",
  "fontWeight",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent",
]);
async function fontValues(
  ctx: ImportContext,
  variable: Variable,
  visited = new Set<string>(),
): Promise<Set<string>> {
  if (visited.has(variable.id)) return new Set();
  visited.add(variable.id);
  const values = new Set<string>();
  for (const value of Object.values(variable.valuesByMode)) {
    if (typeof value === "string") values.add(value);
    else if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "VARIABLE_ALIAS"
    ) {
      const alias = await ctx.api.variables.getVariableByIdAsync(value.id);
      if (alias)
        for (const item of await fontValues(ctx, alias, visited))
          values.add(item);
    }
  }
  return values;
}
export async function prepareBoundFonts(
  ctx: ImportContext,
  node: TextNode | TextPathNode,
  field: string,
  variable: Variable,
) {
  await loadCurrentFonts(ctx, node);
  if (field !== "fontFamily" && field !== "fontStyle") return;
  const values = await fontValues(ctx, variable),
    current = currentFontNames(node),
    families = new Set(current.map((f) => f.family));
  for (const value of values) {
    const candidates = ctx.fonts.filter((f) =>
      field === "fontFamily"
        ? f.fontName.family === value
        : families.has(f.fontName.family) && f.fontName.style === value,
    );
    if (!candidates.length)
      throw new Error(`Missing font token ${field}: ${value}`);
    for (const font of candidates) await ctx.api.loadFontAsync(font.fontName);
  }
}
/** Only caller-supplied relationships are applied; matching literal values never imply a token. */
export async function applyTokenBindings(
  ctx: ImportContext,
  preserved: Set<string>,
): Promise<void> {
  const file = ctx.options.tokens;
  if (!file) return;
  const source: Sketch = {
    ...file,
    _class: "tokenFile",
    do_objectID: `${ctx.file.documentId}:tokens`,
    name: file.collection,
  };
  const ledger = ctx.ledger(source);
  const current = new Map<string, Record<string, string>>();
  for (const [i, binding] of (file.bindings ?? []).entries()) {
    const path = `/bindings/${i}`,
      node = ctx.nodes.get(binding.sourceId),
      variable = ctx.resources.variables.get(binding.token);
    if (!node) {
      ctx.finding(
        "TOKEN_BINDING_SCOPE",
        `Token target ${binding.sourceId} was not imported.`,
        source,
        path,
      );
      continue;
    }
    if (preserved.has(binding.sourceId)) {
      ctx.finding(
        "TOKEN_BINDING_CONFLICT",
        `Token binding ${binding.field} was not changed because local edits were preserved.`,
        source,
        path,
      );
      continue;
    }
    const field = binding.field as
      VariableBindableNodeField | VariableBindableTextField;
    const type = numeric.has(field)
      ? "FLOAT"
      : strings.has(field)
        ? "STRING"
        : field === "visible"
          ? "BOOLEAN"
          : undefined;
    const textField = TEXT_TOKEN_FIELDS.has(field as VariableBindableTextField);
    const textNode = node.type === "TEXT" || node.type === "TEXT_PATH";
    if (
      !type ||
      (textField ? !textNode : !(field in node)) ||
      !variable ||
      variable.resolvedType !== type
    ) {
      ctx.finding(
        "TOKEN_BINDING",
        `Missing or incompatible token ${binding.token} for ${binding.sourceId}.${field}.`,
        source,
        path,
        "error",
      );
      continue;
    }
    await ctx.journal.before(node);
    const ok = await ctx.attempt(
      source,
      path,
      async () => {
        if (node.type === "TEXT" || node.type === "TEXT_PATH")
          await prepareBoundFonts(ctx, node, field, variable);
        node.setBoundVariable(field, variable);
        const alias =
          textField && (node.type === "TEXT" || node.type === "TEXT_PATH")
            ? node.getRangeBoundVariable(
                0,
                node.characters.length,
                field as VariableBindableTextField,
              )
            : node.boundVariables?.[field];
        const passed =
          !!alias &&
          typeof alias !== "symbol" &&
          !Array.isArray(alias) &&
          alias.id === variable.id;
        ctx.report.validations.push({
          kind: "token-binding",
          sourceId: binding.sourceId,
          passed,
          expected: variable.id,
          actual: alias,
          message: `${node.name}: ${field} retains supplied ${binding.token} binding.`,
        });
        if (!passed)
          throw new Error(`Host did not retain ${binding.token} on ${field}.`);
      },
      ["sourceId", "field", "token"],
    );
    if (ok) {
      const owned = current.get(binding.sourceId) ?? {};
      owned[field] = variable.id;
      current.set(binding.sourceId, owned);
    }
  }
  for (const [id, node] of ctx.nodes) {
    if (preserved.has(id)) continue;
    const previous = readData<Record<string, string>>(
        node,
        "tokenBindings",
        {},
      ),
      next = current.get(id) ?? {};
    for (const [field, variableId] of Object.entries(previous)) {
      if (field in next) continue;
      const alias =
        TEXT_TOKEN_FIELDS.has(field as VariableBindableTextField) &&
        (node.type === "TEXT" || node.type === "TEXT_PATH")
          ? node.getRangeBoundVariable(
              0,
              node.characters.length,
              field as VariableBindableTextField,
            )
          : (node.boundVariables as Sketch)?.[field];
      // Remove only a binding previously owned by this supplied token collection.
      if (alias?.id === variableId) {
        await ctx.journal.before(node);
        node.setBoundVariable(field as VariableBindableNodeField, null);
      }
    }
    if (Object.keys(previous).length || Object.keys(next).length)
      writeData(node, "tokenBindings", next);
  }
  ledger.fields("", ["_class", "do_objectID", "name"]);
}
