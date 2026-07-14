/** Resize and encode an image file to a compact data URL for credential logos. */
export async function resizeImageFileToDataUrl(file: File, maxSide = 96): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (jpg, png, webp, or svg)");
  }
  if (file.size > 2_000_000) {
    throw new Error("Image must be under 2MB");
  }

  if (file.type === "image/svg+xml") {
    const text = await file.text();
    if (text.length > 80_000) {
      throw new Error("SVG is too large");
    }
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/png", 0.9);
  if (dataUrl.length > 100_000) {
    throw new Error("Processed logo is too large — try a simpler image");
  }
  return dataUrl;
}
