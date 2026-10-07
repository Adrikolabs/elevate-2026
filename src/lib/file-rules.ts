// Pure file validation rules for student uploads (no browser APIs, so they are unit-testable).

export const MB = 1024 * 1024;

export const HEADSHOT_MAX_BYTES = 5 * MB;
export const PROJECT_IMAGE_MAX_BYTES = 10 * MB;
export const PROJECT_PDF_MAX_BYTES = 25 * MB;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type FileCheck = { ok: true } | { ok: false; title: string; message: string };

export const INVALID_IMAGE: FileCheck = { ok: false, title: "Invalid image", message: "Please upload a JPG, PNG or WEBP image." };
export const INVALID_PDF: FileCheck = { ok: false, title: "Invalid PDF", message: "Please upload a valid PDF document." };
export const TOO_LARGE = (maxBytes: number): FileCheck => ({
  ok: false,
  title: "File too large",
  message: `This file is larger than the allowed limit of ${Math.round(maxBytes / MB)} MB.`,
});

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

type FileLike = { name: string; type: string; size: number };

export function checkImageFile(file: FileLike, maxBytes: number): FileCheck {
  if (!IMAGE_EXTENSIONS.includes(extensionOf(file.name)) || !IMAGE_MIME_TYPES.includes(file.type)) return INVALID_IMAGE;
  if (file.size > maxBytes) return TOO_LARGE(maxBytes);
  if (file.size === 0) return INVALID_IMAGE;
  return { ok: true };
}

export function checkPdfFile(file: FileLike): FileCheck {
  if (extensionOf(file.name) !== "pdf" || file.type !== "application/pdf") return INVALID_PDF;
  if (file.size > PROJECT_PDF_MAX_BYTES) return TOO_LARGE(PROJECT_PDF_MAX_BYTES);
  if (file.size === 0) return INVALID_PDF;
  return { ok: true };
}

/** Detects the real file type from its first bytes so renamed files are rejected. */
export function sniffType(bytes: Uint8Array): "jpeg" | "png" | "webp" | "pdf" | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "pdf";
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}
