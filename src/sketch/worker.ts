import { parseSketch } from "./archive";
self.onmessage = async (
  e: MessageEvent<{ id: string; name: string; bytes: ArrayBuffer }>,
) => {
  try {
    const file = await parseSketch(new Uint8Array(e.data.bytes), e.data.name);
    // Transfer owned asset buffers instead of cloning hundreds of MiB into the UI.
    const transfer = [
      ...new Set(file.assets.map((asset) => asset.bytes.buffer)),
    ].filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
    self.postMessage({ id: e.data.id, file }, { transfer });
  } catch (error) {
    self.postMessage({ id: e.data.id, error: String(error) });
  }
};
