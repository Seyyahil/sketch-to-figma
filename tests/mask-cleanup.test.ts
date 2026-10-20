import { expect, it } from "vitest";
import { cleanupMaskWrappers } from "../src/figma/mask-cleanup";
import { createHost } from "./mock-figma";

it("cleans obsolete mask chains in one traversal without touching inherited instance descendants", async () => {
  const host = createHost(),
    api = host.api;
  const page = api.currentPage;
  const wrapper = (parent: ChildrenMixin, documentId = "DOC") => {
    const node = api.createFrame();
    node.setPluginData("sketch2figma:wrapper", "mask");
    node.setPluginData("sketch2figma:documentId", documentId);
    parent.appendChild(node);
    return node;
  };
  const outer = wrapper(page),
    inner = wrapper(outer);
  const oldPaint = api.createRectangle();
  oldPaint.setPluginData("sketch2figma:wrapper", "outline-paint");
  inner.appendChild(oldPaint);
  const live = wrapper(page),
    source = api.createRectangle();
  source.setPluginData("sketch2figma:sourceId", "SOURCE");
  live.appendChild(source);
  const foreign = wrapper(page, "OTHER");
  const master = api.createComponent();
  const inherited = wrapper(master);
  const instance = master.createInstance();
  page.appendChild(instance);
  Object.defineProperty(instance, "children", {
    get: () => {
      throw new Error("Inherited descendants must not be traversed");
    },
  });
  (page as any).findAll = () => {
    throw new Error("No repeated recursive scans");
  };
  // The real master's empty helper can be removed; the instance tree is immutable.
  const count = await cleanupMaskWrappers([page], "DOC");
  expect(count).toBe(3);
  expect(outer.removed && inner.removed && inherited.removed).toBe(true);
  expect(
    live.removed || source.removed || foreign.removed || instance.removed,
  ).toBe(false);
});
