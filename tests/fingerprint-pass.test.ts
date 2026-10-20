import { expect, it, vi } from "vitest";
import {
  capture,
  FingerprintPass,
  targetFingerprint,
} from "../src/figma/storage";
import { fingerprint } from "../src/core/math";
import { createHost } from "./mock-figma";

/** Original v1/v2 algorithm: existing imported hashes must remain compatible. */
async function originalFingerprint(node: SceneNode, version: 1 | 2 = 2) {
  const snap = capture(node, true, false, true);
  const clean = (s: ReturnType<typeof capture>): any => ({
    props:
      version === 1
        ? Object.fromEntries(
            Object.entries(s.props).filter(
              ([key]) => !["vectorNetwork", "booleanOperation"].includes(key),
            ),
          )
        : s.props,
    children: s.children?.map(clean),
  });
  const componentLinks: Record<string, string | null> = {};
  const visit = async (n: SceneNode) => {
    if (n.type === "INSTANCE")
      componentLinks[n.id] = (await n.getMainComponentAsync())?.id ?? null;
    if ("children" in n) for (const child of n.children) await visit(child);
  };
  await visit(node);
  return fingerprint({
    componentLinks,
    parentId: snap.parentId,
    index: snap.index,
    content: clean(snap),
    ownedAppearance:
      node.parent?.type === "FRAME" &&
      node.parent.getPluginData("sketch2figma:fadeFor") ===
        node.getPluginData("sketch2figma:sourceId")
        ? clean(capture(node.parent, true, false))
        : undefined,
  });
}

it("preserves exact fingerprints while reading shared descendants and component links once per immutable pass", async () => {
  const h = createHost(),
    root = h.api.createFrame(),
    parent = h.api.createFrame(),
    component = h.api.createComponent();
  const text = h.api.createText();
  await h.api.loadFontAsync(text.fontName as FontName);
  text.characters = "Linked text";
  component.appendChild(text);
  const instance = component.createInstance();
  root.appendChild(parent);
  parent.appendChild(instance);
  const leaf = instance.children[0];
  for (const node of [root, parent, instance, leaf])
    node.setPluginData("sketch2figma:sourceId", `source-${node.id}`);
  const expected = await Promise.all(
    [root, parent, instance, leaf].map((n) => originalFingerprint(n)),
  );
  let reads = 0;
  Object.defineProperty(leaf, "opacity", {
    configurable: true,
    get() {
      reads++;
      return 1;
    },
  });
  const main = vi.spyOn(instance, "getMainComponentAsync");
  const pass = new FingerprintPass();
  const actual: string[] = [];
  for (const node of [root, parent, instance, leaf])
    actual.push(await targetFingerprint(node, 2, pass));
  expect(actual).toEqual(expected);
  expect(reads).toBe(1);
  expect(main).toHaveBeenCalledTimes(1);
  pass.clear();
  expect(pass.snapshots.size).toBe(0);
  expect(pass.links.size).toBe(0);
});

it("retains legacy/current hash compatibility and detects local edits with a fresh pass", async () => {
  const h = createHost(),
    frame = h.api.createFrame(),
    vector = h.api.createVector();
  frame.appendChild(vector);
  vector.vectorNetwork = {
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ],
    segments: [{ start: 0, end: 1 }],
    regions: [],
  };
  const before = await targetFingerprint(frame);
  const first = new FingerprintPass();
  expect(await targetFingerprint(frame, 1, first)).toBe(
    await originalFingerprint(frame, 1),
  );
  expect(await targetFingerprint(frame, 2, first)).toBe(before);
  expect(await targetFingerprint(frame, 2, first)).toBe(
    await originalFingerprint(frame, 2),
  );
  first.clear();
  vector.opacity = 0.4;
  const next = new FingerprintPass();
  expect(await targetFingerprint(frame, 2, next)).toBe(
    await targetFingerprint(frame),
  );
  expect(await targetFingerprint(frame, 2, next)).not.toBe(before);
});
