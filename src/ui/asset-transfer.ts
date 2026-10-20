import type { SketchFile } from "../core/types";

/** A transport window, not a limit on image, archive, or document size. */
export const ASSET_CHUNK_BYTES = 512 * 1024;
export const TRANSFER_CANCELLED = new Error("Cancelled");

/** Backpressure prevents Figma's iframe bridge from cloning all image bytes at once. */
export class AssetTransfer {
  private waiting?: {
    requestId: string;
    sequence: number;
    resolve(): void;
    reject(error: Error): void;
  };
  private active?: string;
  private stopped = false;
  constructor(private post: (message: unknown) => void) {}

  acknowledge(requestId: string, sequence: number) {
    const pending = this.waiting;
    if (pending?.requestId !== requestId || pending.sequence !== sequence)
      return;
    this.waiting = undefined;
    pending.resolve();
  }

  fail(requestId: string, error: Error) {
    if (this.waiting?.requestId !== requestId) return;
    const pending = this.waiting;
    this.waiting = undefined;
    pending.reject(error);
  }

  cancel() {
    if (this.active) {
      this.stopped = true;
      this.fail(this.active, TRANSFER_CANCELLED);
    }
  }

  private exchange(message: {
    requestId: string;
    sequence: number;
    [key: string]: unknown;
  }) {
    return new Promise<void>((resolve, reject) => {
      if (this.stopped) {
        reject(TRANSFER_CANCELLED);
        return;
      }
      this.waiting = { ...message, resolve, reject };
      try {
        this.post(message);
      } catch (error) {
        this.fail(
          message.requestId,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });
  }

  async send(
    file: SketchFile,
    requestId: string,
    progress: (sent: number, total: number) => void,
  ) {
    if (this.active) throw new Error("Another asset transfer is active.");
    this.active = requestId;
    this.stopped = false;
    const lengths = file.assets.map((asset) =>
      asset.tiles ? 0 : asset.bytes.byteLength,
    );
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let sequence = 0,
      sent = 0;
    try {
      progress(0, total);
      await this.exchange({
        type: "asset-transfer-start",
        requestId,
        sequence,
        lengths,
        file: {
          ...file,
          assets: file.assets.map(
            ({ imageHash: _hash, imageError: _error, ...asset }) => ({
              ...asset,
              originalByteLength:
                asset.originalByteLength ?? asset.bytes.byteLength,
              bytes: new Uint8Array(),
            }),
          ),
        },
      });
      for (const [index, asset] of file.assets.entries()) {
        for (
          let offset = 0;
          offset < lengths[index];
          offset += ASSET_CHUNK_BYTES
        ) {
          await this.exchange({
            type: "asset-transfer-chunk",
            requestId,
            sequence: ++sequence,
            index,
            offset,
            // Copy only this window; never clone the backing buffer of the whole asset.
            bytes: asset.bytes.slice(offset, offset + ASSET_CHUNK_BYTES),
          });
          sent += Math.min(ASSET_CHUNK_BYTES, lengths[index] - offset);
          progress(sent, total);
        }
      }
      if (this.stopped) throw TRANSFER_CANCELLED;
    } catch (error) {
      // Abort also releases a partially received native image after a local clone error.
      try {
        this.post({ type: "asset-transfer-abort", requestId });
      } catch {}
      throw error;
    } finally {
      this.waiting = undefined;
      this.active = undefined;
    }
  }
}
