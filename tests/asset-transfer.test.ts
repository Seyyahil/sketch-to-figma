import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import {
  AssetTransfer,
  ASSET_CHUNK_BYTES,
  TRANSFER_CANCELLED,
} from "../src/ui/asset-transfer";
import { NativeAssetTransfer } from "../src/figma/asset-transfer";
import { bindingFixture } from "./binding-fixture";
import { createHost } from "./mock-figma";
import { startImport } from "../src/figma/importer";
import { DEFAULT_OPTIONS, type SketchFile } from "../src/core/types";
import { readIndex } from "../src/figma/storage";
import { readPluginMessage } from "../src/ui/plugin-messages";

const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

function connect(
  file: SketchFile,
  createImage: (bytes: Uint8Array) => string = digest,
) {
  const native = new NativeAssetTransfer(createImage),
    messages: any[] = [];
  const sender = new AssetTransfer((raw) => {
    // Exercise the real structured-clone boundary, including sliced backing buffers.
    const m = structuredClone(raw) as any;
    messages.push(m);
    if (m.type === "asset-transfer-start")
      native.begin(m.requestId, m.file, m.lengths);
    else if (m.type === "asset-transfer-chunk") {
      expect(m.bytes.byteLength).toBeLessThanOrEqual(ASSET_CHUNK_BYTES);
      expect(m.bytes.buffer.byteLength).toBe(m.bytes.byteLength);
      native.append(m.requestId, m.sequence, m.index, m.offset, m.bytes);
    } else if (m.type === "asset-transfer-abort") {
      native.abort(m.requestId);
      return;
    }
    sender.acknowledge(m.requestId, m.sequence);
  });
  return {
    native,
    sender,
    messages,
    send: () => sender.send(file, "import", () => {}),
  };
}

it("transfers multiple large images byte-for-byte through bounded messages and releases native image buffers", async () => {
  const file = bindingFixture();
  const first = Uint8Array.from(
    { length: ASSET_CHUNK_BYTES * 3 + 71 },
    (_, i) => i % 251,
  );
  const second = first.slice(17, ASSET_CHUNK_BYTES + 81);
  file.assets = [
    { path: "images/one.png", bytes: first },
    { path: "images/two.jpg", bytes: second },
    { path: "fonts/source.otf", bytes: new Uint8Array([5, 6, 7]) },
  ];
  const images: string[] = [];
  const pipe = connect(file, (bytes) => {
    const hash = digest(bytes);
    images.push(hash);
    return hash;
  });
  await pipe.send();
  const received = pipe.native.take("import");
  expect(images).toEqual([digest(first), digest(second)]);
  expect(received.assets.slice(0, 2).map((a) => a.bytes.byteLength)).toEqual([
    0, 0,
  ]);
  expect(received.assets.map((a) => a.originalByteLength)).toEqual(
    file.assets.map((a) => a.bytes.byteLength),
  );
  expect(received.assets[2].bytes).toEqual(file.assets[2].bytes);
  expect(
    pipe.messages[0].file.assets.every((a: any) => a.bytes.length === 0),
  ).toBe(true);
  expect(file.assets[0].bytes).toBe(first);
  expect(file.assets[0].imageHash).toBeUndefined();
  expect(pipe.native.active).toBe(false);
});

it("waits for the exact acknowledgement, ignores duplicate/stale replies and cancels/retries without losing queued bytes", async () => {
  const file = bindingFixture();
  file.assets = [
    {
      path: "images/photo.png",
      bytes: new Uint8Array(ASSET_CHUNK_BYTES + 7).fill(9),
    },
  ];
  const posts: any[] = [],
    sender = new AssetTransfer((m) => posts.push(m));
  const first = sender.send(file, "first", () => {});
  const rejection = expect(first).rejects.toBe(TRANSFER_CANCELLED);
  await flush();
  expect(posts).toHaveLength(1);
  sender.acknowledge("stale", 0);
  sender.acknowledge("first", 1);
  await flush();
  expect(posts).toHaveLength(1);
  sender.acknowledge("first", 0);
  await flush();
  expect(posts[1].offset).toBe(0);
  sender.acknowledge("first", 0);
  await flush();
  expect(posts).toHaveLength(2);
  sender.cancel();
  await rejection;
  expect(posts[posts.length - 1]).toEqual({
    type: "asset-transfer-abort",
    requestId: "first",
  });
  const retry = sender.send(file, "retry", () => {});
  sender.acknowledge("first", 1);
  sender.acknowledge("retry", 0);
  await flush();
  expect(posts[posts.length - 1].bytes.length).toBe(ASSET_CHUNK_BYTES);
  sender.acknowledge("retry", 1);
  await flush();
  expect(posts[posts.length - 1].offset).toBe(ASSET_CHUNK_BYTES);
  expect(posts[posts.length - 1].bytes.length).toBe(7);
  sender.acknowledge("retry", 2);
  await retry;
  expect(file.assets[0].bytes.length).toBe(ASSET_CHUNK_BYTES + 7);
});

it("handles synchronous clone failures and cancellation immediately after an acknowledgement", async () => {
  const file = bindingFixture();
  file.assets = [{ path: "images/photo.png", bytes: new Uint8Array([1]) }];
  const native = new NativeAssetTransfer(digest);
  let fail = true;
  const sender = new AssetTransfer((m: any) => {
    if (m.type === "asset-transfer-abort") {
      native.abort(m.requestId);
      return;
    }
    if (fail) throw new Error("Data cannot be cloned");
    if (m.type === "asset-transfer-start") {
      native.begin(m.requestId, m.file, m.lengths);
      sender.acknowledge(m.requestId, m.sequence);
      sender.cancel(); // The waiting promise has resolved, but its continuation has not run.
    } else throw new Error("Must never send a chunk after cancellation");
  });
  await expect(sender.send(file, "first", () => {})).rejects.toThrow(
    "Data cannot be cloned",
  );
  fail = false;
  await expect(sender.send(file, "retry", () => {})).rejects.toBe(
    TRANSFER_CANCELLED,
  );
  expect(native.active).toBe(false);
});

it("rejects incomplete, duplicate, out-of-order and overflow chunks without accepting a partial image", () => {
  const file = bindingFixture();
  file.assets = [{ path: "images/photo.png", bytes: new Uint8Array() }];
  const create = vi.fn(digest),
    native = new NativeAssetTransfer(create);
  native.begin("a", file, [3]);
  expect(() => native.begin("b", file, [3])).toThrow("active");
  expect(() => native.take("a")).toThrow("not finished");
  for (const [id, sequence, index, offset, bytes] of [
    ["stale", 1, 0, 0, new Uint8Array([1])],
    ["a", 2, 0, 0, new Uint8Array([1])],
    ["a", 1, 1, 0, new Uint8Array([1])],
    ["a", 1, 0, 1, new Uint8Array([1])],
    ["a", 1, 0, 0, new Uint8Array([1, 2, 3, 4])],
  ] as const)
    expect(() => native.append(id, sequence, index, offset, bytes)).toThrow();
  native.append("a", 1, 0, 0, new Uint8Array([1]));
  expect(() => native.append("a", 1, 0, 0, new Uint8Array([1]))).toThrow();
  expect(create).not.toHaveBeenCalled();
  native.abort("stale");
  expect(native.active).toBe(true);
  native.abort("a");
  native.begin("retry", file, [3]);
  native.append("retry", 1, 0, 0, new Uint8Array([1, 2, 3]));
  expect(native.take("retry").assets[0].imageHash).toBe(
    digest(new Uint8Array([1, 2, 3])),
  );
});

it("keeps original tiled-image identity, uses native image handles in fills/tiles, and reports rejected images", async () => {
  const file = bindingFixture();
  file.pages[0].layers = [
    {
      _class: "bitmap",
      do_objectID: "PHOTO",
      name: "Photo",
      frame: { x: 0, y: 0, width: 50, height: 20 },
      image: { _ref: "images/photo.png" },
    },
    {
      _class: "bitmap",
      do_objectID: "LARGE",
      name: "Large",
      frame: { x: 0, y: 30, width: 500, height: 200 },
      image: { _ref: "images/large.png" },
    },
    {
      _class: "bitmap",
      do_objectID: "BAD",
      name: "Bad",
      frame: { x: 0, y: 300, width: 50, height: 20 },
      image: { _ref: "images/bad.png" },
    },
  ];
  file.assets = [
    { path: "images/photo.png", bytes: new Uint8Array([1, 2, 3]) },
    {
      path: "images/large.png",
      bytes: new Uint8Array([4, 5]),
      tiles: {
        width: 5000,
        height: 2000,
        items: [
          { path: "images/tile.png", x: 0, y: 0, width: 5000, height: 2000 },
        ],
      },
    },
    { path: "images/tile.png", bytes: new Uint8Array([6, 7, 8]) },
    { path: "images/bad.png", bytes: new Uint8Array([0]) },
  ];
  const pipe = connect(file, (bytes) => {
    if (bytes[0] === 0) throw new Error("Image type is unsupported");
    return digest(bytes);
  });
  await pipe.send();
  const input = pipe.native.take("import"),
    host = createHost();
  host.api.createImage = () => {
    throw new Error("Must use already registered native image handles");
  };
  const report = await startImport(host.api, input, {
    ...DEFAULT_OPTIONS,
    fallbackFont: { family: "Inter", style: "Regular" },
  }).result;
  expect(report.state).toBe("complete");
  const index = readIndex(host.api, file.documentId);
  const photo = host.nodes.get(index.nodes.PHOTO.nodeId),
    large = host.nodes.get(index.nodes.LARGE.nodeId);
  expect(photo.fills[0].imageHash).toBe(digest(file.assets[0].bytes));
  expect(large.children[0].fills[0].imageHash).toBe(
    digest(file.assets[2].bytes),
  );
  expect(input.assets[1].originalByteLength).toBe(2);
  expect(input.assets[1].tiles).toEqual(file.assets[1].tiles);
  expect(input.assets.every((asset) => asset.bytes.length === 0)).toBe(true);
  expect(
    report.findings.some(
      (f) =>
        f.code === "IMAGE_FORMAT" &&
        f.severity === "error" &&
        f.message.includes("unsupported"),
    ),
  ).toBe(true);
  const count = host.nodes.size;
  await startImport(host.api, input, DEFAULT_OPTIONS).result;
  expect(host.nodes.size).toBe(count);
});

it("integrates native message acknowledgements, enforces one session and releases cancelled sessions before retry", async () => {
  const code = (
    await build({
      entryPoints: ["src/plugin.ts"],
      bundle: true,
      write: false,
      format: "iife",
      define: { __html__: '""' },
    })
  ).outputFiles[0].text;
  const host = createHost(),
    posts: any[] = [];
  const api = {
    ...host.api,
    showUI() {},
    ui: { postMessage: (m: any) => posts.push(m), onmessage: undefined as any },
  };
  runInNewContext(code, { figma: api, Uint8Array, setTimeout });
  const file = bindingFixture();
  file.assets = [{ path: "images/one.png", bytes: new Uint8Array() }];
  const count = host.nodes.size;
  await api.ui.onmessage({
    type: "asset-transfer-start",
    requestId: "a",
    sequence: 0,
    file,
    lengths: [4],
  });
  expect(posts[posts.length - 1]).toEqual({
    type: "asset-transfer-ack",
    requestId: "a",
    sequence: 0,
  });
  await api.ui.onmessage({
    type: "asset-transfer-start",
    requestId: "b",
    sequence: 0,
    file,
    lengths: [4],
  });
  expect(posts[posts.length - 1].type).toBe("error");
  await api.ui.onmessage({
    type: "asset-transfer-chunk",
    requestId: "a",
    sequence: 1,
    index: 0,
    offset: 0,
    bytes: new Uint8Array([1, 2]),
  });
  expect(posts[posts.length - 1].type).toBe("asset-transfer-ack");
  await api.ui.onmessage({ type: "cancel" });
  await api.ui.onmessage({
    type: "import",
    requestId: "a",
    transferred: true,
    options: DEFAULT_OPTIONS,
  });
  expect(posts[posts.length - 1].message).toContain("not finished");
  expect(host.nodes.size).toBe(count);
  await api.ui.onmessage({
    type: "asset-transfer-start",
    requestId: "retry",
    sequence: 0,
    file,
    lengths: [4],
  });
  expect(posts[posts.length - 1]).toEqual({
    type: "asset-transfer-ack",
    requestId: "retry",
    sequence: 0,
  });
});

it("validates transfer acknowledgements from Figma's nested frame", () => {
  expect(
    readPluginMessage({
      pluginMessage: {
        type: "asset-transfer-ack",
        requestId: "a",
        sequence: 0,
      },
    }),
  ).toEqual({ type: "asset-transfer-ack", requestId: "a", sequence: 0 });
  for (const sequence of [-1, "0", NaN])
    expect(
      readPluginMessage({
        pluginMessage: { type: "asset-transfer-ack", requestId: "a", sequence },
      }),
    ).toBeUndefined();
});
