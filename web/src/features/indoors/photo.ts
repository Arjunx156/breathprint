import type { Language } from "@shared/profile";
import { type ScanReply, ScanReplySchema } from "@shared/scan";
import { client, failure } from "../../lib/api";

/** Enough for Gemini to read a room, and small enough for a slow connection. */
const MAX_SIDE = 1280;
const QUALITY = 0.82;

export type Photo = { url: string; data: string; sample: boolean };

export async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Shrinks a photo and draws it afresh as a JPEG. Redrawing keeps only the
 * pixels, so the camera's EXIF, location included, never leaves the phone.
 */
export async function preparePhoto(file: Blob): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", QUALITY));
  if (!blob) throw new Error("could not encode the photo");
  return { url: URL.createObjectURL(blob), data: await base64(blob), sample: false };
}

/** The demo's kitchen goes as it is, so its saved reading still matches its hash. */
export async function samplePhoto(): Promise<Photo> {
  const url = "/samples/kitchen.jpg";
  const res = await fetch(url);
  if (!res.ok) throw new Error("sample missing");
  return { url, data: await base64(await res.blob()), sample: true };
}

export async function scanPhoto(
  photo: Photo,
  lang: Language,
  demo: boolean,
  signal: AbortSignal,
): Promise<ScanReply> {
  const res = await client.api.scan.$post(
    { json: { image: photo.data, lang, demo } },
    { init: { signal } },
  );
  if (!res.ok) throw await failure(res);
  return ScanReplySchema.parse(await res.json());
}
