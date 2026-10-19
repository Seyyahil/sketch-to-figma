import { expect, it } from "vitest";
import { interFallbackMap } from "../src/ui/font-fallback";
import { DEFAULT_OPTIONS, type Sketch } from "../src/core/types";
import { startImport } from "../src/figma/importer";
import { readData, readIndex } from "../src/figma/storage";
import { overrideTarget } from "../src/figma/symbols";
import { bindingFixture } from "./binding-fixture";
import { createHost } from "./mock-figma";
import { focusedReport } from "../src/ui/report-model";
import { summarizeReport } from "../src/ui/plugin-messages";

const inter = (style: string): FontName => ({ family: "Inter", style });
it("maps the reported missing family to Inter while retaining available named weights and italics", () => {
  const names = [
    "CeraPro-Medium",
    "CeraPro-Bold",
    "CeraPro-Regular",
    "CeraPro-BlackItalic",
    "CeraPro-Black",
    "CeraPro-RegularItalic",
    "Cera Pro-Medium",
    "Cera Pro-Regular",
  ];
  const styles = [
    "Medium",
    "Bold",
    "Regular",
    "Black Italic",
    "Black",
    "Italic",
    "Medium",
    "Regular",
  ];
  const available = [...new Set(styles)].map(inter);
  const plan = interFallbackMap(names, available);
  expect(Object.keys(plan)).toEqual(names);
  expect(Object.values(plan)).toEqual(styles.map(inter));
});
it("prefers the exact named weight rather than a shorter Bold suffix, and preserves italic when a weight is unavailable", () => {
  const plan = interFallbackMap(
    [
      "Source-SemiBold",
      "Source-ExtraBoldItalic",
      "Source-BlackItalic",
      "Source-Book",
      "UnknownFace",
    ],
    [
      inter("Regular"),
      inter("Semi Bold"),
      inter("Bold"),
      inter("Extra Bold Italic"),
      inter("Italic"),
    ],
  );
  expect(plan).toEqual({
    "Source-SemiBold": inter("Semi Bold"),
    "Source-ExtraBoldItalic": inter("Extra Bold Italic"),
    "Source-BlackItalic": inter("Italic"),
    "Source-Book": inter("Regular"),
    UnknownFace: inter("Regular"),
  });
});
it("does not fabricate an unavailable Inter font", () => {
  expect(() =>
    interFallbackMap(
      ["Source-Regular"],
      [{ family: "Arial", style: "Regular" }],
    ),
  ).toThrow("Inter Regular is unavailable");
});
function missingFontFile() {
  const file = bindingFixture();
  const visit = (value: Sketch) => {
    if (!value || typeof value !== "object") return;
    if (value._class === "fontDescriptor")
      value.attributes.name = "Unavailable-Regular";
    for (const child of Object.values(value))
      if (child && typeof child === "object") visit(child as Sketch);
  };
  visit(file);
  return file;
}
it("uses the approved replacement in original local styles, masters and linked instances without changing source metadata or duplicating resources", async () => {
  const h = createHost(),
    file = missingFontFile(),
    original = JSON.stringify(file);
  const options = {
    ...DEFAULT_OPTIONS,
    fontMap: interFallbackMap(["Unavailable-Regular"], [inter("Regular")]),
  };
  const first = await startImport(h.api, file, options).result;
  expect(first.state).toBe("complete");
  expect(first.findings.filter((f) => f.severity === "error")).toEqual([]);
  expect(
    first.findings.some(
      (f) =>
        f.code === "FONT_REPLACED" &&
        f.message.includes("Unavailable-Regular → Inter Regular"),
    ),
  ).toBe(true);
  expect(
    focusedReport(summarizeReport(first))
      .groups.find((group) => group.id === "textStyles")
      ?.issues.some((issue) => issue.finding?.code === "FONT_REPLACED"),
  ).toBe(true);
  const index = readIndex(h.api, file.documentId);
  const style = h.styles.get(index.resources["text:TS"]);
  const masterText = h.nodes.get(index.nodes.T.nodeId);
  const instance = h.nodes.get(index.nodes.I.nodeId);
  const instanceText = overrideTarget(instance, ["T"]) as TextNode;
  expect(style.fontName).toEqual(inter("Regular"));
  expect(masterText.getRangeFontName(0, 7)).toEqual(inter("Regular"));
  expect(masterText.getRangeTextStyleId(0, 7)).toBe(style.id);
  expect(
    instanceText.getRangeTextStyleId(0, instanceText.characters.length),
  ).toBe(style.id);
  expect((await instance.getMainComponentAsync()).id).toBe(
    index.nodes.MASTER.nodeId,
  );
  expect(
    readData<Sketch>(masterText, "source", {}).attributedString.attributes[0]
      .attributes.MSAttributedStringFontAttribute.attributes.name,
  ).toBe("Unavailable-Regular");
  expect(JSON.stringify(file)).toBe(original);
  const resources = [...h.styles.keys()],
    nodes = h.nodes.size;
  const second = await startImport(h.api, file, options).result;
  expect(second.created).toBe(0);
  expect(
    second.findings.some(
      (finding) =>
        finding.code === "FONT_FALLBACK" &&
        finding.message.includes("Unavailable-Regular → Inter Regular"),
    ),
  ).toBe(true);
  expect(h.nodes.size).toBe(nodes);
  expect([...h.styles.keys()]).toEqual(resources);
  // A later import with the real font restores its original typeface using the same identities.
  const list = h.api.listAvailableFontsAsync;
  h.api.listAvailableFontsAsync = async () => [
    ...(await list()),
    { fontName: { family: "Unavailable", style: "Regular" } },
  ];
  const restored = await startImport(h.api, file, DEFAULT_OPTIONS).result;
  expect(restored.state).toBe("complete");
  expect(restored.created).toBe(0);
  expect(readIndex(h.api, file.documentId).resources["text:TS"]).toBe(style.id);
  expect(masterText.getRangeFontName(0, 7)).toEqual({
    family: "Unavailable",
    style: "Regular",
  });
  expect(masterText.getRangeTextStyleId(0, 7)).toBe(style.id);
});
it("rejects an unloadable replacement before creating source pages, styles or components", async () => {
  const h = createHost(),
    file = missingFontFile(),
    count = h.nodes.size;
  h.api.loadFontAsync = async () => {
    throw new Error("Replacement font failed to load");
  };
  const report = await startImport(h.api, file, {
    ...DEFAULT_OPTIONS,
    fontMap: { "Unavailable-Regular": inter("Regular") },
  }).result;
  expect(report.state).toBe("failed");
  expect(report.created).toBe(0);
  expect(h.nodes.size).toBe(count);
  expect(h.styles.size).toBe(0);
  expect(h.variables.size).toBe(0);
  expect(
    report.findings.some(
      (f) =>
        f.code === "IMPORT_STOPPED" &&
        f.message.includes("Replacement font failed to load"),
    ),
  ).toBe(true);
});
it("cancels while loading replacement fonts before creating any source content", async () => {
  const h = createHost(),
    file = missingFontFile(),
    count = h.nodes.size;
  const load = h.api.loadFontAsync;
  let started = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  h.api.loadFontAsync = async (font) => {
    started = true;
    await gate;
    await load(font);
  };
  const run = startImport(h.api, file, {
    ...DEFAULT_OPTIONS,
    fontMap: { "Unavailable-Regular": inter("Regular") },
  });
  await expect.poll(() => started).toBe(true);
  run.cancel();
  release();
  const report = await run.result;
  expect(report.state).toBe("cancelled");
  expect(report.created).toBe(0);
  expect(h.nodes.size).toBe(count);
  expect(h.styles.size).toBe(0);
});
