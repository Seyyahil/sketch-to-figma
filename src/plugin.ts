import { readReport, savedReportId } from "./figma/report-storage";
import { summarizeReport } from "./ui/plugin-messages";
import { startImport, type ImportRun } from "./figma/importer";
import {
  DEFAULT_OPTIONS,
  type ImportOptions,
  type SketchFile,
} from "./core/types";
import { validateTokens } from "./figma/resources";
declare const __html__: string;
figma.showUI(__html__, {
  width: 400,
  height: 520,
  themeColors: true,
  title: "Sketch → Figma",
});
let running: ImportRun | undefined;
const send = (message: unknown) => figma.ui.postMessage(message);
async function initialize() {
  const fonts = await figma.listAvailableFontsAsync();
  send({
    type: "ready",
    fonts: fonts.map((f) => f.fontName),
    hasReport: !!savedReportId(figma),
  });
}
figma.ui.onmessage = async (message: unknown) => {
  const m = message as {
    type: string;
    file?: SketchFile;
    libraries?: SketchFile[];
    options?: ImportOptions;
    requestId?: string;
    targetId?: string;
  };
  let ownImport: ImportRun | undefined;
  try {
    if (m.type === "ui-ready") {
      await initialize();
      return;
    }
    if (m.type === "get-report") {
      if (running) return;
      const id = savedReportId(figma),
        report = id ? readReport(figma.root, id) : null;
      if (!report)
        throw new Error("No saved import report is available in this file.");
      send({ type: "saved-report", report: summarizeReport(report) });
      return;
    }
    if (m.type === "select-layer") {
      if (running || typeof m.targetId !== "string") return;
      const node = await figma.getNodeByIdAsync(m.targetId);
      if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
        throw new Error("The imported layer is no longer available.");
      let page: BaseNode | null = node.parent;
      while (page && page.type !== "PAGE") page = page.parent;
      if (!page || page.type !== "PAGE")
        throw new Error("The imported layer has no page.");
      await figma.setCurrentPageAsync(page);
      page.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      return;
    }
    if (m.type === "cancel") {
      running?.cancel();
      return;
    }
    if (m.type === "import") {
      if (running) throw new Error("Another import is active.");
      if (!m.file || !Array.isArray(m.file.pages))
        throw new Error("Invalid import payload.");
      const options = { ...DEFAULT_OPTIONS, ...m.options };
      if (options.tokens) validateTokens(options.tokens);
      running = ownImport = startImport(
        figma,
        m.file,
        options,
        m.libraries ?? [],
        (done, name) =>
          send({ type: "progress", requestId: m.requestId, done, name }),
      );
      const report = await running.result;
      running = undefined;
      send({
        type: "report",
        requestId: m.requestId,
        report: summarizeReport(report),
      });
    }
  } catch (error) {
    if (ownImport && running === ownImport) running = undefined;
    send({ type: "error", requestId: m.requestId, message: String(error) });
  }
};
// Initialize after the iframe has installed its message listener.
