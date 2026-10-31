// تصغير صورة قبل ما تتحفظ (وتتبعت للتابلت): أطول ضلع 1800 بكسل وجودة JPEG
// 0.82 — كفاية تتقري وتتطبع على ورقة A4، وحجمها صغير.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("الصورة مش مقروءة"));
    img.src = src;
  });
}

function toJpeg(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function compressImageFile(file: File, maxSide = 1800): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return toJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// لف الصورة ربع لفة (لو اتصورت بالعرض).
export async function rotateImage(dataUrl: string, clockwise = true): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return toJpeg(canvas);
}
