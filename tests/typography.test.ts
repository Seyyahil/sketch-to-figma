import { expect, it, vi } from "vitest";
import { loadCurrentFonts } from "../src/figma/typography";
import type { ImportContext } from "../src/figma/context";
import { createHost } from "./mock-figma";
import { bindingFixture } from "./binding-fixture";
import { startImport } from "../src/figma/importer";
import { DEFAULT_OPTIONS, type Sketch } from "../src/core/types";
import { readIndex } from "../src/figma/storage";

it.each(["TEXT", "TEXT_PATH"] as const)(
  "loads the insertion font of empty %s without asking for a character range",
  async (type) => {
    const h = createHost();
    const node = h.api.createText() as unknown as TextNode | TextPathNode;
    Object.assign(node, { type });
    const range = vi.spyOn(node, "getRangeAllFontNames");
    const ctx = { api: h.api } as ImportContext;
    await loadCurrentFonts(ctx, node);
    expect(range).not.toHaveBeenCalled();
    expect(h.loaded.has(JSON.stringify(node.fontName))).toBe(true);
    node.characters = "Ready";
    expect(node.characters).toBe("Ready");
  },
);

it("loads every font in mixed text, including variable-font axes", async () => {
  const first = { family: "Inter", style: "Regular" };
  const second = {
    family: "Inter",
    style: "Bold",
    variationSettings: { wght: 650 },
  };
  const getRangeAllFontNames = vi.fn(() => [first, second]);
  const loadFontAsync = vi.fn(async () => {});
  const node = {
    characters: "Mixed",
    fontName: Symbol("mixed"),
    getRangeAllFontNames,
  } as unknown as TextNode;
  await loadCurrentFonts(
    { api: { loadFontAsync } } as unknown as ImportContext,
    node,
  );
  expect(getRangeAllFontNames).toHaveBeenCalledWith(0, 5);
  expect(loadFontAsync.mock.calls).toEqual([[first], [second]]);
});

it("imports fresh text and reimports a previously empty source text node", async () => {
  const h = createHost(),
    file = bindingFixture();
  const source = file.pages[0].layers.find(
    (s: Sketch) => s.do_objectID === "MIXED",
  );
  source.attributedString = {
    _class: "attributedString",
    string: "",
    attributes: [],
  };
  const options = { ...DEFAULT_OPTIONS, conflict: "replace-imported" as const };
  const first = await startImport(h.api, file, options).result;
  expect(first.findings.filter((f) => f.severity === "error")).toEqual([]);
  expect(first.state).toBe("complete");
  const id = readIndex(h.api, file.documentId).nodes.MIXED.nodeId;
  expect(h.nodes.get(id).characters).toBe("");
  source.attributedString.string = "Now populated";
  const second = await startImport(h.api, file, options).result;
  expect(second.findings.filter((f) => f.severity === "error")).toEqual([]);
  expect(second.state).toBe("complete");
  expect(readIndex(h.api, file.documentId).nodes.MIXED.nodeId).toBe(id);
  expect(h.nodes.get(id).characters).toBe("Now populated");
});
