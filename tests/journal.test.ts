import { describe, expect, it } from "vitest";
import { createHost } from "./mock-figma";
import {
  emptyIndex,
  Journal,
  readData,
  readIndex,
  readJournal,
  recover,
  capture,
  restore,
  writeData,
  writeIndex,
} from "../src/figma/storage";

describe("durable incremental recovery journal", () => {
  it("recovers existing layers, page metadata, new content and the index after restart", async () => {
    const h = createHost();
    const page = h.api.currentPage;
    page.name = "Original page";
    const rect = h.api.createRectangle();
    page.appendChild(rect);
    rect.name = "Original";
    rect.setPluginData("original", "kept");
    const originalIndex = emptyIndex("DOC");
    originalIndex.pages.P = page.id;
    writeIndex(h.api, originalIndex);
    const journal = new Journal(h.api, originalIndex);
    journal.beforePage(page);
    await journal.before(rect);
    page.name = "Changed page";
    rect.name = "Changed";
    rect.setPluginData("original", "changed");
    const created = h.api.createFrame();
    journal.track(created);
    created.appendChild(rect);
    const changedIndex = { ...originalIndex, sourceDigest: "changed" };
    writeIndex(h.api, changedIndex);

    // Reconstruct exclusively from durable data, as a reopened plugin does.
    const restored = readJournal(h.api)!;
    expect(restored).toEqual(journal.data);
    expect(await recover(h.api, restored)).toEqual([]);
    expect(rect.name).toBe("Original");
    expect(rect.parent?.id).toBe(page.id);
    expect(rect.getPluginData("original")).toBe("kept");
    expect(page.name).toBe("Original page");
    expect(created.removed).toBe(true);
    expect(readIndex(h.api, "DOC")).toEqual(originalIndex);
    expect(readJournal(h.api)).toBeNull();
    expect(
      h.api.root
        .getPluginDataKeys()
        .filter((k) => /journal-(entry|index):/.test(k))
        .some((k) => h.api.root.getPluginData(k) !== ""),
    ).toBe(false);
  });

  it("reads legacy journals and retains recoverable snapshots after a failed restore", async () => {
    const h = createHost();
    const rect = h.api.createRectangle();
    h.api.currentPage.appendChild(rect);
    rect.name = "Before";
    const journal = new Journal(h.api, emptyIndex("DOC"));
    await journal.before(rect);
    rect.name = "After";
    writeData(h.api.root, "journal", journal.data);
    expect(readJournal(h.api)).toEqual(journal.data);
    const original = rect.setFillStyleIdAsync;
    rect.setFillStyleIdAsync = async () => {
      throw new Error("Temporary host failure");
    };
    expect(await recover(h.api, readJournal(h.api)!)).toHaveLength(1);
    expect(readJournal(h.api)?.state).toBe("recovery-needed");
    rect.setFillStyleIdAsync = original;
    expect(await recover(h.api, readJournal(h.api)!)).toEqual([]);
    expect(rect.name).toBe("Before");
    expect(readJournal(h.api)).toBeNull();
  });

  it("restores sibling and page order after earlier moves changed later snapshot indices", async () => {
    const h = createHost();
    const page = h.api.currentPage;
    const first = h.api.createFrame();
    const second = h.api.createFrame();
    page.appendChild(first);
    page.appendChild(second);
    const a = h.api.createRectangle();
    const b = h.api.createRectangle();
    first.appendChild(a);
    first.appendChild(b);
    const journal = new Journal(h.api, emptyIndex("DOC"));
    journal.beforePage(page);
    await journal.before(first);
    page.appendChild(first);
    await journal.before(second); // its current index is now 0
    page.appendChild(second);
    await journal.before(a);
    first.appendChild(a);
    await journal.before(b); // its current index is also now 0
    first.appendChild(b);
    expect(await recover(h.api, readJournal(h.api)!)).toEqual([]);
    expect(page.children.map((n) => n.id)).toEqual([first.id, second.id]);
    expect(first.children.map((n) => n.id)).toEqual([a.id, b.id]);
  });

  it("refuses incomplete persisted records instead of proceeding with partial recovery", async () => {
    const h = createHost();
    const journal = new Journal(h.api, emptyIndex("DOC"));
    const rect = h.api.createRectangle();
    journal.track(rect);
    writeData(h.api.root, "journal-entry:0", null);
    expect(() => readJournal(h.api)).toThrow("Missing recovery journal entry");
  });

  it("respects native freeform setters and does not reparent existing instance children", async () => {
    const h = createHost();
    const component = h.api.createComponent();
    const child = h.api.createRectangle();
    child.setPluginData("sketch2figma:sourceId", "A");
    component.appendChild(child);
    const sibling = h.api.createRectangle();
    sibling.setPluginData("sketch2figma:sourceId", "B");
    component.appendChild(sibling);
    const instance = component.createInstance();
    const snapshot = capture(instance, true);
    // Restoring the master can change inherited order before instance overrides
    // are restored. Match by source ID; only the master owns that hierarchy.
    snapshot.children!.reverse();
    const insert = instance.insertChild;
    instance.insertChild = () => {
      throw new Error("Cannot move children inside an instance");
    };
    instance.removeOverrides = () => {};
    const target = instance.children[0] as RectangleNode;
    target.opacity = 0.4;
    snapshot.children!.find(
      (c) => c.plugin["sketch2figma:sourceId"] === "A",
    )!.props.relativeTransform = [
      [1, 0, 100],
      [0, 1, 100],
    ];
    Object.defineProperty(target, "relativeTransform", {
      configurable: true,
      get: () => [
        [1, 0, 0],
        [0, 1, 0],
      ],
      set: () => {
        throw new Error("This property cannot be overridden in an instance");
      },
    });
    for (const node of [instance, target]) {
      for (const field of ["itemReverseZIndex", "strokesIncludedInLayout"]) {
        Object.defineProperty(node, field, {
          configurable: true,
          get: () => false,
          set: () => {
            throw new Error("Can only set on nodes with layoutMode !== NONE");
          },
        });
      }
    }
    await restore(h.api, instance, snapshot);
    expect(target.opacity).toBe(1);
    expect(instance.children[0]).toBe(target);
    instance.insertChild = insert;
  });

  it("writes storage proportional to the new snapshots rather than their cumulative size", async () => {
    async function storedBytes(count: number) {
      const h = createHost();
      let bytes = 0;
      const original = h.api.root.setPluginData.bind(h.api.root);
      h.api.root.setPluginData = (key, value) => {
        bytes += value.length;
        original(key, value);
      };
      const index = emptyIndex("DOC");
      // A large existing source index must be persisted once, too.
      index.sourceDigest = "index".repeat(10000);
      const journal = new Journal(h.api, index);
      for (let i = 0; i < count; i++) {
        const rect = h.api.createRectangle();
        rect.setPluginData("source", "source".repeat(1000));
        await journal.before(rect);
      }
      expect(Object.keys(readJournal(h.api)!.snapshots)).toHaveLength(count);
      journal.commit();
      expect(readData(h.api.root, "journal", null)).toBeNull();
      return bytes;
    }
    const small = await storedBytes(100);
    const large = await storedBytes(200);
    expect(large).toBeLessThan(small * 2.1);
    expect(large).toBeLessThan(3_000_000);
  });
});
