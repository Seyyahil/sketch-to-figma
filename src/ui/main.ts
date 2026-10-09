import { renderReport } from "./report-view";
import { focusedReport } from "./report-model";
import { prepareAssets, nativePayload } from "./asset-preparation";
import { readPluginMessage, type ImportSummary } from "./plugin-messages";
import { parseSketch } from "../sketch/archive";
import { importFontNames } from "../core/resource-selection";
import { matchFont } from "../figma/typography";
import { validateTokens } from "../figma/resources";
import {
  DEFAULT_OPTIONS,
  type ImportOptions,
  type ResourceKind,
  type SketchFile,
  type TokenFile,
} from "../core/types";

declare const __WORKER__: string;
interface QueueItem {
  id: string;
  source: File;
  file?: SketchFile;
  error?: string;
  parsing: boolean;
}
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const kinds: ResourceKind[] = [
  "colors",
  "layerStyles",
  "textStyles",
  "components",
  "tokens",
];
const queue: QueueItem[] = [];
const pending = new Map<
  string,
  {
    resolve: (report: ImportSummary) => void;
    reject: (error: Error) => void;
  }
>();
let reportOpen = false,
  hasSavedReport = false,
  readingReport = false;
const reports: ImportSummary[] = [];
let statusRevision = 0;
let serial = 0,
  initialized = false,
  running = false,
  cancelled = false;
let currentRequest: string | undefined,
  fonts: FontName[] = [];
let tokens: TokenFile | undefined,
  tokenName = "",
  tokenError = "",
  tokenLoading = false,
  tokenRevision = 0;
let worker: Worker | undefined;
const requestId = () => `${Date.now()}-${++serial}`;
const post = (message: unknown) =>
  parent.postMessage({ pluginMessage: message }, "*");
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
function status(text: string, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
  return ++statusRevision;
}
function removeButton(label: string, remove: () => void) {
  const button = el("button", "×");
  button.className = "icon";
  button.setAttribute("aria-label", label);
  button.disabled = running;
  button.onclick = () => {
    if (!running) remove();
  };
  return button;
}
function render() {
  $("import-panel").setAttribute("aria-busy", String(running));
  $("import-indicator").hidden = !running;
  $("import-content").hidden = running || reportOpen;
  $("report-panel").hidden = running || !reportOpen;
  $("import-panel").classList.toggle("showing-report", reportOpen && !running);
  $("import-footer").hidden = reportOpen && !running;
  const failed = reports.reduce((n, r) => n + focusedReport(r).issueCount, 0);
  const reportButton = $("view-report") as HTMLButtonElement;
  reportButton.hidden =
    running || reportOpen || (!reports.length && !hasSavedReport);
  reportButton.disabled = readingReport;
  reportButton.textContent = readingReport
    ? "Loading report…"
    : reports.length
      ? failed
        ? `View import report (${failed})`
        : "View import report"
      : "View saved import report";
  const list = $("queue");
  list.replaceChildren();
  for (const item of queue) {
    const row = el("li"),
      name = el("span", item.source.name);
    row.className = item.parsing ? "file file-reading" : "file";
    row.setAttribute("aria-busy", String(item.parsing));
    name.className = "file-name";
    name.title = item.source.name;
    row.append(name);
    if (item.parsing || item.error) {
      const state = el(
        "span",
        item.error ? "Error" : item.file ? "Preparing…" : "Reading…",
      );
      state.className = "file-state" + (item.error ? " file-error" : "");
      state.title = item.error ?? "";
      row.append(state);
    }
    if (item.parsing) {
      const bar = el("div");
      bar.className = "file-progress";
      bar.setAttribute("role", "progressbar");
      bar.setAttribute(
        "aria-label",
        `${item.file ? "Preparing" : "Reading"} ${item.source.name}`,
      );
      const segment = el("span");
      segment.setAttribute("aria-hidden", "true");
      bar.append(segment);
      row.append(bar);
    }
    row.append(
      removeButton(`Remove ${item.source.name}`, () => {
        queue.splice(queue.indexOf(item), 1);
        status("");
        render();
      }),
    );
    list.append(row);
  }
  const attachment = $("token-name");
  attachment.replaceChildren();
  attachment.hidden = !tokenName;
  if (tokenName) {
    const name = el("span", tokenLoading ? "Reading…" : tokenName);
    name.className = "file-name" + (tokenError ? " file-error" : "");
    name.title = tokenError || tokenName;
    attachment.append(
      name,
      removeButton(`Remove ${tokenName}`, () => {
        tokenRevision++;
        tokens = undefined;
        tokenName = tokenError = "";
        tokenLoading = false;
        status("");
        render();
      }),
    );
  }
  $("drop").toggleAttribute("disabled", running);
  $("files").toggleAttribute("disabled", running);
  $("resources").toggleAttribute("disabled", running);
  $("import").toggleAttribute(
    "disabled",
    running ||
      !initialized ||
      tokenLoading ||
      !!tokenError ||
      !queue.length ||
      queue.some((q) => q.parsing || !!q.error || !q.file),
  );
  $("cancel").hidden = !running;
  $("cancel").toggleAttribute("disabled", cancelled);
  $("progress").hidden = !running;
}
async function acceptParsed(
  item: QueueItem,
  file?: SketchFile,
  error?: string,
) {
  if (!queue.includes(item)) return;
  let preparationStatus: number | undefined;
  try {
    if (error) throw new Error(error);
    if (!file) throw new Error("Archive could not be read.");
    const duplicate = queue.find(
      (q) => q !== item && q.file?.documentId === file.documentId,
    );
    if (duplicate) {
      if (
        (duplicate.file!.digest === file.digest && !duplicate.error) ||
        queue.indexOf(item) < queue.indexOf(duplicate)
      ) {
        queue.splice(queue.indexOf(item), 1);
        status(`${item.source.name}: already added.`);
        return;
      }
      // A newly chosen revision replaces the queued archive, never its source IDs.
      queue.splice(queue.indexOf(duplicate), 1);
      status(`${item.source.name}: updated.`);
    }
    // Claim this document before asynchronous asset preparation to avoid duplicate worker replies.
    item.file = file;
    render();
    await prepareAssets(file, () => {
      if (queue.includes(item))
        preparationStatus = status(`Preparing ${item.source.name}…`);
    });
  } catch (error) {
    item.error = message(error);
    if (queue.includes(item))
      status(`${item.source.name}: ${item.error}`, true);
  } finally {
    item.parsing = false;
    // Do not erase a newer error or another file's preparation message.
    if (preparationStatus !== undefined && preparationStatus === statusRevision)
      status("");
    render();
  }
}
try {
  const url = URL.createObjectURL(
    new Blob([__WORKER__], { type: "text/javascript" }),
  );
  try {
    worker = new Worker(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  worker.onmessage = (event) => {
    const item = queue.find((q) => q.id === event.data.id);
    if (item) void acceptParsed(item, event.data.file, event.data.error);
  };
  worker.onerror = (event) => {
    worker?.terminate();
    worker = undefined;
    for (const item of queue)
      if (item.parsing && !item.file) {
        item.parsing = false;
        item.error = "Archive reader failed. Remove and retry.";
      }
    status(event.message || "Archive reader failed. Remove and retry.", true);
    render();
  };
} catch {
  // Hosts that disallow blob workers use the same bounded parser on the UI thread.
}
async function addSketch(source: File) {
  const item: QueueItem = { id: requestId(), source, parsing: true };
  queue.push(item);
  render();
  try {
    const bytes = await source.arrayBuffer();
    if (!queue.includes(item)) return;
    if (worker)
      worker.postMessage({ id: item.id, name: source.name, bytes }, [bytes]);
    else
      await acceptParsed(
        item,
        await parseSketch(new Uint8Array(bytes), source.name),
      );
  } catch (error) {
    await acceptParsed(item, undefined, message(error));
  }
}
async function attachTokens(source: File) {
  const revision = ++tokenRevision;
  tokenLoading = true;
  tokenName = source.name;
  tokenError = "";
  tokens = undefined;
  render();
  try {
    const value = validateTokens(JSON.parse(await source.text()));
    if (revision === tokenRevision) {
      tokens = value;
      status("");
    }
  } catch (error) {
    if (revision === tokenRevision) {
      tokenError = message(error);
      status(`${source.name}: ${tokenError}`, true);
    }
  } finally {
    if (revision === tokenRevision) {
      tokenLoading = false;
      render();
    }
  }
}
async function addFiles(files: File[]) {
  if (running) return;
  status("");
  // Start each read before awaiting; all outstanding files keep Import disabled.
  await Promise.all(
    files.map((file) => {
      if (/\.sketch$/i.test(file.name)) return addSketch(file);
      if (/\.json$/i.test(file.name)) return attachTokens(file);
      status(`${file.name}: expected .sketch or token JSON.`, true);
    }),
  );
}
$("drop").onclick = () => $("files").click();
$("files").onchange = (event) => {
  const input = event.target as HTMLInputElement;
  void addFiles([...(input.files ?? [])]);
  input.value = "";
};
for (const type of ["dragover", "dragleave", "drop"])
  document.addEventListener(type, (event) => {
    event.preventDefault();
    if (running) return;
    $("drop").classList.toggle("drag", type === "dragover");
    if (type === "drop")
      void addFiles([...((event as DragEvent).dataTransfer?.files ?? [])]);
  });
async function importBatch() {
  if (running || $("import").hasAttribute("disabled")) return;
  const input = [...queue],
    options: ImportOptions = {
      ...DEFAULT_OPTIONS,
      resourceTypes: Object.fromEntries(
        kinds.map((kind) => [kind, $<HTMLInputElement>(kind).checked]),
      ),
      tokens,
    };
  const missing = [
    ...new Set(input.flatMap((q) => importFontNames(q.file!, options))),
  ].filter(
    (name) =>
      !matchFont(
        name,
        fonts.map((fontName) => ({ fontName })),
      ),
  );
  if (missing.length) {
    status(`Missing fonts: ${missing.join(", ")}`, true);
    return;
  }
  running = true;
  reportOpen = false;
  reports.length = 0;
  $("report-list").replaceChildren();
  cancelled = false;
  render();
  const summaries: string[] = [];
  let issues = false;
  try {
    for (const [i, item] of input.entries()) {
      if (cancelled) break;
      const id = (currentRequest = requestId());
      status(
        input.length > 1
          ? `Importing ${i + 1}/${input.length} · ${item.source.name}`
          : `Importing ${item.source.name}…`,
      );
      $("progress").removeAttribute("value");
      const result = new Promise<ImportSummary>((resolve, reject) =>
        pending.set(id, { resolve, reject }),
      );
      post({
        type: "import",
        requestId: id,
        file: nativePayload(item.file!),
        options,
      });
      const report = await result;
      reports.push({ ...report, file: report.file ?? item.source.name });
      hasSavedReport = true;
      const { issueCount } = focusedReport(report);
      issues ||= report.state !== "complete" || issueCount > 0;
      summaries.push(
        `${input.length > 1 ? item.source.name + ": " : ""}${report.state === "complete" ? "Imported" : report.state === "cancelled" ? "Cancelled" : "Failed"}${issueCount ? ` · ${issueCount} issue${issueCount === 1 ? "" : "s"}` : ""}`,
      );
      if (report.state !== "complete") break;
    }
    if (cancelled && !summaries.some((s) => s.includes("Cancelled")))
      summaries.push("Cancelled");
    status(summaries.join("\n"), issues);
  } catch (error) {
    status(message(error), true);
  } finally {
    running = false;
    currentRequest = undefined;
    render();
  }
}
function showReports() {
  const list = $("report-list");
  list.replaceChildren();
  for (const report of reports)
    renderReport(list, report, (targetId) =>
      post({ type: "select-layer", targetId }),
    );
  reportOpen = true;
  render();
}
$("view-report").onclick = () => {
  if (running || readingReport) return;
  if (reports.length) showReports();
  else {
    readingReport = true;
    post({ type: "get-report" });
    render();
  }
};
$("report-back").onclick = () => {
  reportOpen = false;
  render();
};
$("import").onclick = () => void importBatch();
$("cancel").onclick = () => {
  if (!running) return;
  cancelled = true;
  post({ type: "cancel" });
  status("Cancelling…");
  render();
};
window.onmessage = (event) => {
  const m = readPluginMessage(event.data);
  if (!m) return;
  if (m.type === "ready") {
    initialized = true;
    hasSavedReport = m.hasReport === true;
    fonts = m.fonts;
    render();
  }
  if (
    m.type === "progress" &&
    running &&
    !cancelled &&
    m.requestId === currentRequest
  )
    status(`Importing · ${m.done} layers`);
  if (m.type === "report") {
    pending.get(m.requestId)?.resolve(m.report);
    pending.delete(m.requestId);
  }
  if (m.type === "saved-report" && readingReport) {
    readingReport = false;
    if (!running) {
      reports.length = 0;
      reports.push(m.report);
      showReports();
    }
  }
  if (m.type === "error") {
    readingReport = false;
    render();
    if (m.requestId) {
      pending.get(m.requestId)?.reject(new Error(m.message));
      pending.delete(m.requestId);
    } else status(m.message, true);
  }
};
post({ type: "ui-ready" });
render();
