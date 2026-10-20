import { readReportSummary, savedReportId } from "./figma/report-storage";
import { summarizeReport } from "./ui/plugin-messages";
import { startImport, type ImportRun } from "./figma/importer";
import {
  DEFAULT_OPTIONS,
  type ImportOptions,
  type SketchFile,
} from "./core/types";
import { validateTokens } from "./figma/resources";
import { NativeAssetTransfer } from "./figma/asset-transfer";
declare const __html__: string;
figma.showUI(__html__, {
  width: 400,
  height: 520,
  themeColors: true,
  title: "Sketch → Figma",
});
let running: ImportRun | undefined;
const assets = new NativeAssetTransfer(
  (bytes) => figma.createImage(bytes).hash,
);
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
    lengths?: number[];
    sequence?: number;
    index?: number;
    offset?: number;
    bytes?: Uint8Array;
    transferred?: boolean;
  };
  let ownImport: ImportRun | undefined;
  try {
    if (!m || typeof m.type !== "string") return;
    if (m.type === "ui-ready") {
      await initialize();
      return;
    }
    if (m.type === "get-fonts" && typeof m.requestId === "string") {
      const fonts = await figma.listAvailableFontsAsync();
      send({
        type: "fonts",
        requestId: m.requestId,
        fonts: fonts.map((font) => font.fontName),
      });
      return;
    }
    if (m.type === "get-report") {
      if (running || assets.active) return;
      const id = savedReportId(figma),
        report = id ? readReportSummary(figma.root, id) : null;
      if (!report)
        throw new Error("No saved import report is available in this file.");
      send({ type: "saved-report", report });
      return;
    }
    if (m.type === "select-layer") {
      if (running || assets.active || typeof m.targetId !== "string") return;
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
      assets.abort();
      running?.cancel();
      return;
    }
    if (m.type === "asset-transfer-abort") {
      if (typeof m.requestId === "string") assets.abort(m.requestId);
      return;
    }
    if (m.type === "asset-transfer-start") {
      if (running) throw new Error("Another import is active.");
      if (typeof m.requestId !== "string" || m.sequence !== 0)
        throw new Error("Invalid asset transfer request.");
      assets.begin(m.requestId, m.file!, m.lengths!);
      send({ type: "asset-transfer-ack", requestId: m.requestId, sequence: 0 });
      return;
    }
    if (m.type === "asset-transfer-chunk") {
      assets.append(m.requestId!, m.sequence!, m.index!, m.offset!, m.bytes!);
      send({
        type: "asset-transfer-ack",
        requestId: m.requestId,
        sequence: m.sequence,
      });
      return;
    }
    if (m.type === "import") {
      if (running) throw new Error("Another import is active.");
      if (m.transferred) m.file = assets.take(m.requestId!);
      else if (assets.active)
        throw new Error("Another asset transfer is active.");
      if (!m.file || !Array.isArray(m.file.pages))
        throw new Error("Invalid import payload.");
      const options = { ...DEFAULT_OPTIONS, ...m.options };
      if (options.tokens) validateTokens(options.tokens);
      running = ownImport = startImport(
        figma,
        m.file,
        options,
        m.libraries ?? [],
        (done, name, phase) =>
          send({ type: "progress", requestId: m.requestId, done, name, phase }),
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
    if (assets.owns(m.requestId)) assets.abort(m.requestId);
    if (ownImport && running === ownImport) running = undefined;
    send({ type: "error", requestId: m.requestId, message: String(error) });
  }
};
// Initialize after the iframe has installed its message listener.
