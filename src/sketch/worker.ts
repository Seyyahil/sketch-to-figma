import { parseSketch } from "./archive";
self.onmessage = async (
  e: MessageEvent<{ id: string; name: string; bytes: ArrayBuffer }>,
) => {
  try {
    const file = await parseSketch(new Uint8Array(e.data.bytes), e.data.name);
    self.postMessage({ id: e.data.id, file });
  } catch (error) {
    self.postMessage({ id: e.data.id, error: String(error) });
  }
};
