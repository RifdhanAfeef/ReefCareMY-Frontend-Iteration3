// Reads camera capture time from JPEG, PNG or WebP EXIF metadata.
// The file's lastModified date is not used: copying or downloading a photo resets it.

const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;
const OFFSET_TIME_ORIGINAL = 0x9011;
const MALAYSIA_OFFSET = "+08:00";
// Read only small chunk headers and the bounded EXIF payload, even when metadata
// follows image data. Download/modified timestamps are never used as capture times.
const MAX_EXIF_BYTES = 256 * 1024;
const MAX_CHUNKS = 2048;

async function readBytes(file: Blob, start: number, length: number): Promise<DataView> {
  const part = file.slice(start, start + length);
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

async function readExifPayload(file: Blob, start: number, length: number) {
  if (length < 8 || length > MAX_EXIF_BYTES || start + length > file.size) return null;
  const view = await readBytes(file, start, length);
  const prefix = ascii(view, 0, 4) === "Exif" && view.getUint16(4) === 0 ? 6 : 0;
  return new DataView(view.buffer, view.byteOffset + prefix, view.byteLength - prefix);
}

/** JPEG APP1, PNG eXIf and WebP EXIF all contain a TIFF metadata payload. */
async function readTiff(file: Blob) {
  const header = await readBytes(file, 0, 12);
  if (header.byteLength < 2) return null;
  if (header.getUint16(0) === 0xffd8) {
    let position = 2;
    for (let count = 0; count < MAX_CHUNKS && position + 2 <= file.size; count += 1) {
      const marker = await readBytes(file, position, 4);
      if (marker.getUint8(0) !== 0xff) return null;
      const id = marker.getUint8(1);
      if (id === 0xda || id === 0xd9) return null;
      if (id === 0xff) { position += 1; continue; }
      if (id === 0x01 || (id >= 0xd0 && id <= 0xd7)) { position += 2; continue; }
      if (marker.byteLength < 4) return null;
      const length = marker.getUint16(2);
      if (length < 2 || position + 2 + length > file.size) return null;
      if (id === 0xe1 && length >= 8) {
        const prefix = await readBytes(file, position + 4, 6);
        if (ascii(prefix, 0, 4) === "Exif" && prefix.getUint16(4) === 0) {
          return readExifPayload(file, position + 4, length - 2);
        }
      }
      position += 2 + length;
    }
    return null;
  }
  if (header.byteLength < 12) return null;
  const webp = ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 4) === "WEBP";
  const png = header.getUint32(0) === 0x89504e47 && header.getUint32(4) === 0x0d0a1a0a;
  if (!webp && !png) return null;
  const end = webp ? Math.min(file.size, header.getUint32(4, true) + 8) : file.size;
  let position = webp ? 12 : 8;
  for (let count = 0; count < MAX_CHUNKS && position + 8 <= end; count += 1) {
    const chunk = await readBytes(file, position, 8);
    const length = chunk.getUint32(webp ? 4 : 0, webp);
    const id = ascii(chunk, webp ? 0 : 4, 4);
    const next = position + 8 + length + (webp ? length % 2 : 4);
    if (next > end) return null;
    if (id === (webp ? "EXIF" : "eXIf")) return readExifPayload(file, position + 8, length);
    if (!webp && id === "IEND") return null;
    position = next;
  }
  return null;
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
  if (start < 0 || start + tag.count > view.byteLength) return null;
  return ascii(view, start, tag.count).trim() || null;
}

/** "2026:10:08 10:15:00" (+ optional "+08:00") -> ISO string, or null when invalid or in the future. */
export function exifDateToIso(value: string | null, offset: string | null, now = Date.now()) {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  // EXIF stores local camera time without a zone unless OffsetTimeOriginal is present.
  // ReefCare observations are in Malaysia, so a missing offset is read as Malaysia time.
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month)
    || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (offset && (!/^[+-]\d{2}:\d{2}$/.test(offset) || Number(offset.slice(1, 3)) > 14
    || Number(offset.slice(4)) > 59 || (Number(offset.slice(1, 3)) === 14 && Number(offset.slice(4)) !== 0))) return null;
  const zone = offset || MALAYSIA_OFFSET;
  const parsed = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${zone}`);
  if (Number.isNaN(parsed) || parsed > now) return null;
  return new Date(parsed).toISOString();
}

/** The photo's EXIF capture time as an ISO string, or null when the photo has none. */
export async function readExifCaptureTime(file: Blob): Promise<string | null> {
  try {
    const view = await readTiff(file);
    const tiff = 0;
    if (!view || view.byteLength < 8) return null;
    const order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4d4d) return null;
    const little = order === 0x4949;
    if (view.getUint16(2, little) !== 42) return null;
    const ifd0 = readIfdTags(view, tiff, view.getUint32(tiff + 4, little), little);
    const pointer = ifd0.get(EXIF_IFD_POINTER);
    if (!pointer || pointer.type !== 4 || pointer.count !== 1) return null;
    const exif = readIfdTags(view, tiff, view.getUint32(pointer.valueOffset, little), little);
    const original = asciiTag(view, tiff, exif.get(DATE_TIME_ORIGINAL), little)
      ?? asciiTag(view, tiff, exif.get(DATE_TIME_DIGITIZED), little);
    return exifDateToIso(original, asciiTag(view, tiff, exif.get(OFFSET_TIME_ORIGINAL), little));
  } catch {
    return null;
  }
}
