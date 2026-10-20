const HEX = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, "0"),
);

/** Join bounded pieces instead of repeatedly copying a growing string in the plugin VM. */
export function encodeHex(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 4096) {
    const end = Math.min(start + 4096, bytes.length),
      part: string[] = [];
    for (let i = start; i < end; i++) part.push(HEX[bytes[i]]);
    chunks.push(part.join(""));
  }
  return chunks.join("");
}

/** Decode directly, without a whole-file regex or millions of two-character strings. */
export function decodeHex(data: string): Uint8Array {
  if (data.length % 2) throw new Error("Invalid hex data.");
  const bytes = new Uint8Array(data.length / 2);
  const nibble = (code: number) =>
    code >= 48 && code <= 57
      ? code - 48
      : code >= 97 && code <= 102
        ? code - 87
        : -1;
  for (let i = 0; i < bytes.length; i++) {
    const high = nibble(data.charCodeAt(i * 2)),
      low = nibble(data.charCodeAt(i * 2 + 1));
    if (high < 0 || low < 0) throw new Error("Invalid hex data.");
    bytes[i] = (high << 4) | low;
  }
  return bytes;
}
