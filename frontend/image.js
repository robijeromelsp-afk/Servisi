// Image downscaling in the browser before upload.
// Longer side at most MAX_SIDE px, JPEG, EXIF orientation applied.

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.82;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns { blob, mime, width, height, originalSize, resized }.
 * PDFs and images that cannot be decoded are returned unchanged.
 */
export async function prepareFile(file) {
  const base = { blob: file, mime: file.type || 'application/octet-stream', originalSize: file.size, resized: false };
  if (!file.type.startsWith('image/')) return base;
  let img;
  try {
    img = await decode(file);
  } catch (e) {
    return base; // e.g. HEIC on a browser that cannot decode it: upload the original
  }
  const w = img.width || img.naturalWidth;
  const hgt = img.height || img.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, hgt));
  const cw = Math.round(w * scale);
  const ch = Math.round(hgt * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; // transparent PNG areas become white, not black
  g.fillRect(0, 0, cw, ch);
  g.drawImage(img, 0, 0, cw, ch);
  if (img.close) img.close();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
  if (!blob) return base;
  // A small JPEG can grow when re-encoded; keep the original then.
  if (scale === 1 && file.type === 'image/jpeg' && file.size <= blob.size) return { ...base, width: w, height: hgt };
  return { blob, mime: 'image/jpeg', width: cw, height: ch, originalSize: file.size, resized: true };
}

export function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' kB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
