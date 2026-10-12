import type { ReportSubmissionPayload } from "./types";

export class ReportPhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportPhotoUploadError";
  }
}

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function readPhotoBytes(photo: File): Promise<ArrayBuffer> {
  try {
    if (typeof photo.arrayBuffer === "function") return await photo.arrayBuffer();
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Unreadable photo"));
      reader.onerror = () => reject(reader.error);
      reader.onabort = () => reject(new Error("Photo read cancelled"));
      reader.readAsArrayBuffer(photo);
    });
  } catch {
    throw new ReportPhotoUploadError("Your saved photograph could not be read. Return to observation details and attach it again.");
  }
}

function detectedType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (text(4, 8) === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(text(8, 12))) return "image/heic";
  return null;
}

/** Materialise restored photo bytes before constructing the final multipart upload. */
export async function prepareReportFormData(payload: ReportSubmissionPayload, photos: File[]): Promise<FormData> {
  if (photos.length === 0) throw new ReportPhotoUploadError("No photograph is attached. Return to observation details and attach an image.");
  if (payload.evidenceMetadata.length !== photos.length) throw new ReportPhotoUploadError("Your photographs and their saved details do not match. Return to observation details and attach them again.");
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  for (const [index, photo] of photos.entries()) {
    if (!(photo instanceof Blob) || photo.size === 0) throw new ReportPhotoUploadError("An attached photograph is empty or missing. Return to observation details and attach it again.");
    if (photo.size > 10 * 1024 * 1024) throw new ReportPhotoUploadError("An attached photograph exceeds 10 MB. Choose a smaller image.");
    const bytes = await readPhotoBytes(photo);
    if (bytes.byteLength === 0 || bytes.byteLength !== photo.size) throw new ReportPhotoUploadError("The saved photograph could not be read completely. Return to observation details and attach it again.");
    const detected = detectedType(new Uint8Array(bytes));
    const declared = photo.type.toLowerCase() === "image/jpg" ? "image/jpeg" : photo.type.toLowerCase();
    if (detected === "image/heic" || (!detected && ["image/heic", "image/heif"].includes(declared))) throw new ReportPhotoUploadError("This photograph is HEIC/HEIF. Choose a JPG, PNG or WebP image, or use a screenshot.");
    const mimeType = detected ?? declared;
    const extension = extensions[mimeType];
    if (!extension) throw new ReportPhotoUploadError("The photograph’s format could not be confirmed. Choose a JPG, PNG or WebP image.");
    const filename = `${(photo.name || `reef-photo-${index + 1}`).replace(/\.[^.]+$/, "")}.${extension}`;
    const file = new File([bytes], filename, { type: mimeType, lastModified: photo.lastModified || 0 });
    formData.append("photos", file, filename);
  }
  return formData;
}

/** Inspect the actual multipart entries without retaining payload values or filenames. */
export function inspectReportFormData(formData: FormData) {
  return {
    payloadPresent: typeof formData.get("payload") === "string",
    photoParts: formData.getAll("photos").filter((part) => part instanceof Blob).length,
    entries: Array.from(formData.entries()).map(([field, value]) => typeof value === "string"
      ? { field, kind: "text" as const }
      : { field, kind: "file" as const, sizeBytes: value.size, mimeType: value.type }),
  };
}

export type PreparedReportUpload = ReturnType<typeof inspectReportFormData>;
