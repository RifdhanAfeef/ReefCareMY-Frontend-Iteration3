import { apiBlobRequest, type ApiRequestOptions } from "./client";

async function readHeader(blob: Blob): Promise<Uint8Array> {
  // Inspect only the header, not another full copy of a potentially large photo.
  const header = blob.slice(0, 32);
  if (typeof header.arrayBuffer === "function") return new Uint8Array(await header.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(new Uint8Array(reader.result)) : reject(new Error("Unreadable evidence image."));
    reader.onerror = () => reject(new Error("Unreadable evidence image."));
    reader.onabort = () => reject(new Error("Evidence image read cancelled."));
    reader.readAsArrayBuffer(header);
  });
}

/** Converted evidence may retain the original HEIC or generic Content-Type.
 * Use its actual image signature for display, never its filename or MIME label.
 * This does not convert raw HEIC or bypass the authorised evidence endpoint.
 */
export async function prepareEvidenceImage(blob: Blob): Promise<Blob> {
  if (!blob.size) throw new Error("The evidence image is empty.");
  const bytes = await readHeader(blob);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
    : [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) ? "image/png"
      : text(0, 4) === "RIFF" && text(8, 12) === "WEBP" ? "image/webp" : null;
  if (!type) throw new Error("The evidence is not a supported display image.");
  // Retag only: preserve the full response bytes, without re-encoding the photo.
  return blob.type === type ? blob : blob.slice(0, blob.size, type);
}

/** Shared by Observer and Coordinator report, reply and follow-up evidence. */
export async function apiEvidenceImageRequest(options: ApiRequestOptions): Promise<Blob> {
  return prepareEvidenceImage(await apiBlobRequest(options));
}
