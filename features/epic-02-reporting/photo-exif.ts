// Reads the camera capture time from a photo's EXIF data (JPEG APP1 or WebP EXIF chunk).
// The file's lastModified date is not used: copying or downloading a photo resets it.

const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;
const OFFSET_TIME_ORIGINAL = 0x9011;
const MALAYSIA_OFFSET = "+08:00";
// Capture metadata sits near the start of the file; no need to read whole photos.
const HEADER_BYTES = 256 * 1024;

async function readHeader(file: Blob): Promise<DataView> {
  const part = file.slice(0, HEADER_BYTES);
  if (typeof part.arrayBuffer === "function") return new DataView(await part.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new DataView(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(part);
  });
}

function ascii(view: DataView, start: number, length: number) {
  let text = "";
  for (let index = start; index < start + length && index < view.byteLength; index += 1) {
    const code = view.getUint8(index);
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text;
}

/** Finds the TIFF header that holds the EXIF IFDs, or -1. */
function tiffStart(view: DataView) {
  if (view.byteLength > 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= view.byteLength && view.getUint8(offset) === 0xff) {
      const marker = view.getUint8(offset + 1);
      const length = view.getUint16(offset + 2);
      if (marker === 0xe1 && ascii(view, offset + 4, 4) === "Exif") return offset + 10;
      if (marker === 0xda) break; // image data starts; no EXIF before it
      offset += 2 + length;
    }
    return -1;
  }
  if (view.byteLength > 12 && ascii(view, 0, 4) === "RIFF" && ascii(view, 8, 4) === "WEBP") {
    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const id = ascii(view, offset, 4);
      const size = view.getUint32(offset + 4, true);
      if (id === "EXIF") return ascii(view, offset + 8, 4) === "Exif" ? offset + 14 : offset + 8;
      offset += 8 + size + (size % 2);
    }
  }
  return -1;
}

function readIfdTags(view: DataView, tiff: number, ifdOffset: number, little: boolean) {
  const tags = new Map<number, { type: number; count: number; valueOffset: number }>();
  const start = tiff + ifdOffset;
  if (start + 2 > view.byteLength) return tags;
  const entries = view.getUint16(start, little);
  for (let index = 0; index < entries; index += 1) {
    const entry = start + 2 + index * 12;
    if (entry + 12 > view.byteLength) break;
    tags.set(view.getUint16(entry, little), {
      type: view.getUint16(entry + 2, little),
      count: view.getUint32(entry + 4, little),
      valueOffset: entry + 8,
    });
  }
  return tags;
}

function asciiTag(view: DataView, tiff: number, tag: { type: number; count: number; valueOffset: number } | undefined, little: boolean) {
  if (!tag || tag.type !== 2) return null;
  const start = tag.count > 4 ? tiff + view.getUint32(tag.valueOffset, little) : tag.valueOffset;
  return ascii(view, start, tag.count).trim() || null;
}

/** "2026:10:08 10:15:00" (+ optional "+08:00") -> ISO string, or null when invalid or in the future. */
export function exifDateToIso(value: string | null, offset: string | null, now = Date.now()) {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  // EXIF stores local camera time without a zone unless OffsetTimeOriginal is present.
  // ReefCare observations are in Malaysia, so a missing offset is read as Malaysia time.
  const zone = offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : MALAYSIA_OFFSET;
  const parsed = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${zone}`);
  if (Number.isNaN(parsed) || parsed > now) return null;
  return new Date(parsed).toISOString();
}

/** The photo's EXIF capture time as an ISO string, or null when the photo has none. */
export async function readExifCaptureTime(file: Blob): Promise<string | null> {
  try {
    const view = await readHeader(file);
    const tiff = tiffStart(view);
    if (tiff < 0 || tiff + 8 > view.byteLength) return null;
    const order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4d4d) return null;
    const little = order === 0x4949;
    const ifd0 = readIfdTags(view, tiff, view.getUint32(tiff + 4, little), little);
    const pointer = ifd0.get(EXIF_IFD_POINTER);
    if (!pointer) return null;
    const exif = readIfdTags(view, tiff, view.getUint32(pointer.valueOffset, little), little);
    const original = asciiTag(view, tiff, exif.get(DATE_TIME_ORIGINAL), little)
      ?? asciiTag(view, tiff, exif.get(DATE_TIME_DIGITIZED), little);
    return exifDateToIso(original, asciiTag(view, tiff, exif.get(OFFSET_TIME_ORIGINAL), little));
  } catch {
    return null;
  }
}
