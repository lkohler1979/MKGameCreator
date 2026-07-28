export type DetectedShape = {
  id: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
};

const ALPHA_THRESHOLD = 20;
const MIN_AREA_RATIO = 0.002;
const CORNER_SAMPLE_SIZE = 12;
const BACKGROUND_COLOR_THRESHOLD = 50;

function sampleCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cornerX: number,
  cornerY: number,
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = cornerY; y < cornerY + CORNER_SAMPLE_SIZE && y < height; y += 1) {
    for (let x = cornerX; x < cornerX + CORNER_SAMPLE_SIZE && x < width; x += 1) {
      const offset = (y * width + x) * 4;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count += 1;
    }
  }

  return count > 0 ? [r / count, g / count, b / count] : [255, 255, 255];
}

/**
 * Amostra a cor do fundo nos 4 cantos da foto (mesma amostra usada pela
 * máscara de primeiro plano) — reaproveitada pra colorir o céu do jogo com a
 * cor real do papel do desenho.
 */
export function sampleBackgroundColor(canvas: HTMLCanvasElement): [number, number, number] {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || width === 0 || height === 0) return [255, 255, 255];

  const { data } = ctx.getImageData(0, 0, width, height);
  const corners = [
    sampleCornerColor(data, width, height, 0, 0),
    sampleCornerColor(data, width, height, width - CORNER_SAMPLE_SIZE, 0),
    sampleCornerColor(data, width, height, 0, height - CORNER_SAMPLE_SIZE),
    sampleCornerColor(data, width, height, width - CORNER_SAMPLE_SIZE, height - CORNER_SAMPLE_SIZE),
  ];

  return corners.reduce(
    (acc, corner) =>
      [
        acc[0] + corner[0] / corners.length,
        acc[1] + corner[1] / corners.length,
        acc[2] + corner[2] / corners.length,
      ] as [number, number, number],
    [0, 0, 0] as [number, number, number],
  );
}

export function backgroundColorToHex([r, g, b]: [number, number, number]): string {
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Constrói uma máscara de primeiro plano bem literal (sem IA): usa a cor de
 * fundo amostrada e marca como "fundo" (alpha 0) qualquer pixel parecido com
 * essa cor. Usada só para alimentar a detecção de formas — a remoção de fundo
 * por IA (@imgly/background-removal) isola apenas "o assunto principal" da
 * imagem e descarta elementos desenhados separadamente (moedas/obstáculos),
 * o que quebraria a detecção.
 */
export function buildForegroundMask(
  canvas: HTMLCanvasElement,
  threshold = BACKGROUND_COLOR_THRESHOLD,
): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;

  const ctx = canvas.getContext("2d");
  const maskCtx = maskCanvas.getContext("2d");
  if (!ctx || !maskCtx || width === 0 || height === 0) return maskCanvas;

  const { data } = ctx.getImageData(0, 0, width, height);
  const backgroundColor = sampleBackgroundColor(canvas);

  const output = maskCtx.createImageData(width, height);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const distance = Math.sqrt(
      (r - backgroundColor[0]) ** 2 + (g - backgroundColor[1]) ** 2 + (b - backgroundColor[2]) ** 2,
    );

    output.data[offset] = r;
    output.data[offset + 1] = g;
    output.data[offset + 2] = b;
    output.data[offset + 3] = distance > threshold ? 255 : 0;
  }
  maskCtx.putImageData(output, 0, 0);

  return maskCanvas;
}

/**
 * Separa as formas/traços distintos desenhados numa imagem (connected-
 * component labeling sobre o canal alpha) — processamento de imagem
 * clássico, sem depender de nenhuma IA de visão computacional.
 */
export function detectShapes(canvas: HTMLCanvasElement): DetectedShape[] {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || width === 0 || height === 0) return [];

  const { data } = ctx.getImageData(0, 0, width, height);
  const isForeground = (pixelIndex: number) => data[pixelIndex * 4 + 3] > ALPHA_THRESHOLD;

  const visited = new Uint8Array(width * height);
  const minArea = width * height * MIN_AREA_RATIO;
  const shapes: DetectedShape[] = [];

  for (let startIndex = 0; startIndex < width * height; startIndex += 1) {
    if (visited[startIndex] || !isForeground(startIndex)) continue;

    const stack = [startIndex];
    visited[startIndex] = 1;
    const pixels: number[] = [];
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      pixels.push(current);

      const cx = current % width;
      const cy = (current - cx) / width;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      const neighbors = [
        cx > 0 ? current - 1 : -1,
        cx < width - 1 ? current + 1 : -1,
        cy > 0 ? current - width : -1,
        cy < height - 1 ? current + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && !visited[neighbor] && isForeground(neighbor)) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }

    if (pixels.length < minArea) continue;

    const blobWidth = maxX - minX + 1;
    const blobHeight = maxY - minY + 1;
    const shapeCanvas = document.createElement("canvas");
    shapeCanvas.width = blobWidth;
    shapeCanvas.height = blobHeight;
    const shapeCtx = shapeCanvas.getContext("2d");
    if (!shapeCtx) continue;

    const shapeImageData = shapeCtx.createImageData(blobWidth, blobHeight);
    for (const pixelIndex of pixels) {
      const px = pixelIndex % width;
      const py = (pixelIndex - px) / width;
      const srcOffset = pixelIndex * 4;
      const dstOffset = ((py - minY) * blobWidth + (px - minX)) * 4;
      shapeImageData.data[dstOffset] = data[srcOffset];
      shapeImageData.data[dstOffset + 1] = data[srcOffset + 1];
      shapeImageData.data[dstOffset + 2] = data[srcOffset + 2];
      shapeImageData.data[dstOffset + 3] = data[srcOffset + 3];
    }
    shapeCtx.putImageData(shapeImageData, 0, 0);

    shapes.push({
      id: `shape-${shapes.length}`,
      canvas: shapeCanvas,
      x: minX + blobWidth / 2,
      y: minY + blobHeight / 2,
      width: blobWidth,
      height: blobHeight,
      area: pixels.length,
    });
  }

  return shapes.sort((a, b) => b.area - a.area);
}
