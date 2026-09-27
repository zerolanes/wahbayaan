import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["model/gltf-binary", ".glb"],
  ["video/mp4", ".mp4"],
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function uploadDir() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
}

/**
 * Store an uploaded file on local disk and register it in the media library.
 * Returns its public URL under /media. Swap this for object storage (S3/R2) in
 * production by replacing the write below.
 */
export async function saveUpload(file: File, opts: { uploadedById?: string | null; alt?: string | null } = {}) {
  const type = file.type || (file.name.endsWith(".glb") ? "model/gltf-binary" : "");
  const ext = ALLOWED.get(type);
  if (!ext) throw new Error("Unsupported file type. Use JPG, PNG, WebP, AVIF, MP4 or GLB.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 10 MB.");
  const name = `${new Date().toISOString().slice(0, 7)}/${crypto.randomBytes(12).toString("hex")}${ext}`;
  const target = path.join(uploadDir(), name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
  const url = `/media/${name}`;
  const d = await db();
  await d.insert(media).values({ url, filename: file.name, mime: type, sizeBytes: file.size, alt: opts.alt ?? null, uploadedById: opts.uploadedById ?? null });
  return url;
}

export async function saveUploads(files: File[], opts: { uploadedById?: string | null } = {}) {
  const urls: string[] = [];
  for (const f of files) if (f && f.size > 0) urls.push(await saveUpload(f, opts));
  return urls;
}
