/** Remove obsolete owned mask containers without scanning inherited instance trees. */
export async function cleanupMaskWrappers(
  pages: Iterable<PageNode>,
  documentId: string,
  progress: (visited: number) => void = () => {},
): Promise<number> {
  const nodes: SceneNode[] = [];
  const stack = [...pages].flatMap((page) => [...page.children]);
  while (stack.length) {
    const node = stack.pop()!;
    nodes.push(node);
    if (
      node.type !== "INSTANCE" &&
      node.getPluginData("sketch2figma:wrapper") !== "outline-paint" &&
      "children" in node
    )
      stack.push(...node.children);
    if (nodes.length % 256 === 0) {
      progress(nodes.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  const retainedSource = new Set<string>();
  let removed = 0;
  for (const node of nodes.reverse()) {
    if (node.removed) continue;
    const containsSource =
      node.type === "INSTANCE" ||
      !!node.getPluginData("sketch2figma:sourceId") ||
      ("children" in node &&
        node.children.some((child) => retainedSource.has(child.id)));
    if (
      node.type === "FRAME" &&
      node.getPluginData("sketch2figma:wrapper") === "mask" &&
      node.getPluginData("sketch2figma:documentId") === documentId &&
      !containsSource
    ) {
      node.remove();
      removed++;
    } else if (containsSource) retainedSource.add(node.id);
  }
  return removed;
}
