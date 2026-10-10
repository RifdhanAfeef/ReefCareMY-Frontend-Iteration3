import { describe, expect, it } from "vitest";
import { exifDateToIso, readExifCaptureTime } from "../photo-exif";

/** A minimal JPEG whose APP1 segment holds an EXIF IFD with DateTimeOriginal (and optional offset). */
function jpegWithExif(dateTimeOriginal: string, offsetTime?: string) {
  const entries: Array<[number, string]> = [[0x9003, dateTimeOriginal]];
  if (offsetTime) entries.push([0x9011, offsetTime]);
  const tiff: number[] = [];
  const u16 = (value: number) => tiff.push((value >> 8) & 0xff, value & 0xff);
  const u32 = (value: number) => tiff.push((value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  // Big-endian TIFF header; IFD0 at 8 with one entry pointing to the EXIF IFD at 26.
  tiff.push(0x4d, 0x4d); u16(42); u32(8);
  u16(1); u16(0x8769); u16(4); u32(1); u32(26); u32(0);
  const exifIfd = 26;
  const dataStart = exifIfd + 2 + entries.length * 12 + 4;
  u16(entries.length);
  let dataOffset = dataStart;
  const data: number[] = [];
  for (const [tag, value] of entries) {
    const bytes = [...value].map((char) => char.charCodeAt(0)).concat(0);
    u16(tag); u16(2); u32(bytes.length); u32(dataOffset);
    data.push(...bytes);
    dataOffset += bytes.length;
  }
  u32(0);
  tiff.push(...data);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const length = app1.length + 2;
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...app1, 0xff, 0xd9])], { type: "image/jpeg" });
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

function chunk(id: string, payload: Uint8Array, webp: boolean) {
  const bytes = new Uint8Array(8 + payload.length + (webp ? payload.length % 2 : 4));
  const view = new DataView(bytes.buffer);
  view.setUint32(webp ? 4 : 0, payload.length, webp);
  bytes.set([...id].map((char) => char.charCodeAt(0)), webp ? 0 : 4);
  bytes.set(payload, 8);
  return bytes;
}

describe("photo EXIF capture time (QA-R4-02)", () => {
  it("reads DateTimeOriginal as Malaysia time when the photo has no offset", async () => {
    await expect(readExifCaptureTime(jpegWithExif("2026:10:08 10:15:00"))).resolves.toBe("2026-10-08T02:15:00.000Z");
  });

  it("uses OffsetTimeOriginal when the camera recorded it", async () => {
    await expect(readExifCaptureTime(jpegWithExif("2026:10:08 10:15:00", "+09:00"))).resolves.toBe("2026-10-08T01:15:00.000Z");
  });

  it("returns null for a photo without EXIF data", async () => {
    const plain = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9])], { type: "image/jpeg" });
    await expect(readExifCaptureTime(plain)).resolves.toBeNull();
    await expect(readExifCaptureTime(new Blob(["not an image"]))).resolves.toBeNull();
  });

  it("rejects malformed and future capture times", () => {
    expect(exifDateToIso("2026:13:40 99:00:00", null)).toBeNull();
    expect(exifDateToIso("0000:00:00 00:00:00", null)).toBeNull();
    expect(exifDateToIso("2030:01:01 00:00:00", null, Date.parse("2026-10-09T00:00:00Z"))).toBeNull();
  });
  it.each(["PNG", "WebP"])("reads %s capture metadata after a large image chunk", async (format) => {
    const jpeg = await blobBytes(jpegWithExif("2026:10:08 10:15:00", "+08:00"));
    const tiff = jpeg.slice(12, -2);
    const webp = format === "WebP";
    const image = chunk(webp ? "VP8 " : "IDAT", new Uint8Array(300 * 1024), webp);
    const metadata = chunk(webp ? "EXIF" : "eXIf", tiff, webp);
    const header = webp ? new Uint8Array(12) : new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    if (webp) {
      header.set([82, 73, 70, 70]);
      new DataView(header.buffer).setUint32(4, 4 + image.length + metadata.length, true);
      header.set([87, 69, 66, 80], 8);
    }
    await expect(readExifCaptureTime(new Blob([header, image, metadata]))).resolves.toBe("2026-10-08T02:15:00.000Z");
  });

  it("rejects impossible calendar dates, invalid offsets and truncated EXIF", async () => {
    expect(exifDateToIso("2026:02:30 10:00:00", null)).toBeNull();
    expect(exifDateToIso("2025:02:29 10:00:00", null)).toBeNull();
    expect(exifDateToIso("2024:02:29 10:00:00", null)).toBe("2024-02-29T02:00:00.000Z");
    expect(exifDateToIso("2026:10:08 10:00:00", "+08:99")).toBeNull();
    const full = jpegWithExif("2026:10:08 10:15:00");
    await expect(readExifCaptureTime(full.slice(0, full.size - 10))).resolves.toBeNull();
  });
});
