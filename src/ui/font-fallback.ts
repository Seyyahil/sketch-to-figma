import { normalizeFont } from "../figma/typography";

const face = (name: string) =>
  normalizeFont(name)
    .replace(/oblique$/, "italic")
    .replace(/^(normal|roman|book)$/, "regular")
    .replace(/^(regular|normal|roman|book)italic$/, "italic");
const sourceFaces = [
  "Thin",
  "ExtraLight",
  "UltraLight",
  "Light",
  "Regular",
  "Normal",
  "Roman",
  "Book",
  "Medium",
  "SemiBold",
  "DemiBold",
  "Bold",
  "ExtraBold",
  "UltraBold",
  "Black",
  "Heavy",
]
  .flatMap((weight) => [weight, `${weight}Italic`, `${weight}Oblique`])
  .concat(["Italic", "Oblique"])
  .sort((a, b) => b.length - a.length);

/** An explicit, user-approved replacement plan; never changes the source font names. */
export function interFallbackMap(
  names: readonly string[],
  available: readonly FontName[],
): Record<string, FontName> {
  const inter = new Map(
    available
      .filter((font) => normalizeFont(font.family) === "inter")
      .map((font) => [face(font.style), font]),
  );
  const regular = inter.get("regular");
  if (!regular)
    throw new Error(
      "Inter Regular is unavailable in Figma. Activate it and retry.",
    );
  return Object.fromEntries(
    names.map((name) => {
      const normalized = normalizeFont(name.replace(/MT$/, ""));
      const source = sourceFaces.find((style) =>
        normalized.endsWith(normalizeFont(style)),
      );
      const requested = source ? face(source) : "regular";
      const replacement =
        inter.get(requested) ??
        (requested.endsWith("italic") ? inter.get("italic") : undefined) ??
        regular;
      return [name, replacement];
    }),
  );
}
