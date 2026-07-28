export type RotationDegrees = 0 | 90 | 180 | 270;

export async function rotateImageFile(
  file: File | Blob,
  degrees: RotationDegrees,
  filename = "image.png",
): Promise<File> {
  const mimeType = file.type || "image/png";

  if (degrees === 0) {
    return file instanceof File ? file : new File([file], filename, { type: mimeType });
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
      img.src = url;
    });

    const swapDimensions = degrees === 90 || degrees === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swapDimensions ? image.height : image.width;
    canvas.height = swapDimensions ? image.width : image.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível rotacionar a imagem.");

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType));
    if (!blob) throw new Error("Não foi possível rotacionar a imagem.");

    return new File([blob], filename, { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Carrega uma imagem (File/Blob/URL) num canvas, opcionalmente reduzindo pro
 * lado maior não passar de `maxDimension` — usado para manter a detecção de
 * formas rápida independente do tamanho da foto original.
 */
export async function loadImageToCanvas(
  source: File | Blob | string,
  maxDimension?: number,
): Promise<HTMLCanvasElement> {
  const isExternalUrl = typeof source === "string";
  const url = isExternalUrl ? source : URL.createObjectURL(source);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (isExternalUrl) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
      img.src = url;
    });

    let { width, height } = image;
    if (maxDimension && Math.max(width, height) > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    if (!isExternalUrl) URL.revokeObjectURL(url);
  }
}
