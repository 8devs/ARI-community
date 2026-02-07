import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const BUCKETS = ["avatars", "logos", "documents", "menus", "attachments"] as const;
export type BucketName = typeof BUCKETS[number];

// Ensure upload directories exist
export function ensureUploadDirs() {
  for (const bucket of BUCKETS) {
    const dir = path.join(UPLOAD_DIR, bucket);
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getUploadPath(bucket: BucketName, filename: string): string {
  return path.join(UPLOAD_DIR, bucket, filename);
}

export function getPublicUrl(bucket: BucketName, filename: string): string {
  return `/uploads/${bucket}/${filename}`;
}

export function generateFilename(originalName: string, prefix?: string): string {
  const ext = path.extname(originalName);
  const id = crypto.randomUUID();
  return prefix ? `${prefix}-${id}${ext}` : `${id}${ext}`;
}

export function deleteFile(bucket: BucketName, filename: string): boolean {
  try {
    const filePath = path.join(UPLOAD_DIR, bucket, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Extract filename from a public URL like /uploads/avatars/abc.jpg
export function filenameFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/uploads\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

export { UPLOAD_DIR };
