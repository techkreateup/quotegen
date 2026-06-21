// Client-side image compression. Re-encodes photos to WebP at a capped
// resolution BEFORE upload, so we store ~5-20x less (critical on a 2GB plan).
// SVGs and already-tiny files pass through untouched; if the re-encode somehow
// ends up larger, we keep the original.

export interface CompressOptions {
  /** Longest-edge cap in px. Avatars 512, logos 600, generic 1600. */
  maxDim?: number;
  /** WebP quality 0..1. */
  quality?: number;
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDim = 1024, quality = 0.82 } = opts;

  // Don't touch non-raster images (SVG) or non-images.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  // Already small — not worth the work.
  if (file.size < 40 * 1024) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // decoding failed — upload original
  }

  let { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality)
  );
  if (!blob || blob.size >= file.size) return file; // no gain — keep original

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}
