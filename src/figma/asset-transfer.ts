import type { SketchFile } from "../core/types";

/** Holds metadata and at most one image buffer; completed images live in Figma. */
export class NativeAssetTransfer {
  private session?: {
    requestId: string;
    file: SketchFile;
    lengths: number[];
    index: number;
    sequence: number;
    offset: number;
    buffer?: Uint8Array;
  };
  constructor(private createImage: (bytes: Uint8Array) => string) {}
  get active() {
    return !!this.session;
  }
  owns(requestId: unknown) {
    return !!this.session && this.session.requestId === requestId;
  }

  begin(requestId: string, file: SketchFile, lengths: number[]) {
    if (this.session) throw new Error("Another asset transfer is active.");
    if (
      !requestId ||
      !file ||
      !Array.isArray(file.pages) ||
      !Array.isArray(file.assets) ||
      !Array.isArray(lengths) ||
      lengths.length !== file.assets.length ||
      lengths.some((length) => !Number.isSafeInteger(length) || length < 0) ||
      file.assets.some(
        (asset) =>
          !asset ||
          typeof asset.path !== "string" ||
          !(asset.bytes instanceof Uint8Array) ||
          asset.bytes.byteLength !== 0,
      ) ||
      new Set(file.assets.map((asset) => asset.path)).size !==
        file.assets.length
    )
      throw new Error("Invalid asset transfer metadata.");
    this.session = {
      requestId,
      file: {
        ...file,
        assets: file.assets.map((asset) => {
          const { imageHash: _hash, imageError: _error, ...metadata } = asset;
          return metadata;
        }),
      },
      lengths,
      index: 0,
      sequence: 0,
      offset: 0,
    };
    this.skipEmpty();
  }

  private skipEmpty() {
    const session = this.session!;
    while (
      session.index < session.lengths.length &&
      session.lengths[session.index] === 0
    )
      session.index++;
  }

  append(
    requestId: string,
    sequence: number,
    index: number,
    offset: number,
    bytes: Uint8Array,
  ) {
    const session = this.session;
    if (!session || session.requestId !== requestId)
      throw new Error("Asset transfer is no longer active.");
    const length = session.lengths[session.index];
    if (
      length === undefined ||
      sequence !== session.sequence + 1 ||
      index !== session.index ||
      offset !== session.offset ||
      !(bytes instanceof Uint8Array) ||
      !bytes.byteLength ||
      offset + bytes.byteLength > length
    )
      throw new Error("Asset transfer is incomplete or out of order.");
    session.buffer ??= new Uint8Array(length);
    session.buffer.set(bytes, offset);
    session.offset += bytes.byteLength;
    session.sequence = sequence;
    if (session.offset === length) {
      const asset = session.file.assets[index];
      if (asset.path.startsWith("images/")) {
        try {
          asset.imageHash = this.createImage(session.buffer);
        } catch (error) {
          asset.imageError = String(error);
        }
      } else asset.bytes = session.buffer;
      session.buffer = undefined;
      session.offset = 0;
      session.index++;
      this.skipEmpty();
    }
  }

  take(requestId: string): SketchFile {
    const session = this.session;
    if (
      !session ||
      session.requestId !== requestId ||
      session.index !== session.lengths.length
    )
      throw new Error("Asset transfer has not finished.");
    this.session = undefined;
    return session.file;
  }

  abort(requestId?: string) {
    if (requestId === undefined || this.owns(requestId))
      this.session = undefined;
  }
}
