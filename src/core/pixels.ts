export interface PixelDiff {
  width: number;
  height: number;
  changedPixels: number;
  totalPixels: number;
  changedRatio: number;
  meanAbsoluteError: number;
  maxError: number;
  threshold: number;
  heatmap: Uint8ClampedArray;
}
export function comparePixels(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 16,
): PixelDiff {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    a.length !== width * height * 4 ||
    b.length !== a.length
  )
    throw new Error("Pixel buffers must have identical positive dimensions.");
  const heatmap = new Uint8ClampedArray(a.length);
  let changedPixels = 0,
    sum = 0,
    maxError = 0;
  for (let i = 0; i < a.length; i += 4) {
    let error = 0;
    for (let j = 0; j < 4; j++) {
      const d = Math.abs(a[i + j] - b[i + j]);
      sum += d;
      error = Math.max(error, d);
    }
    if (error > threshold) changedPixels++;
    maxError = Math.max(maxError, error);
    heatmap[i] = error > threshold ? 235 : Math.round(a[i] * 0.25);
    heatmap[i + 1] = error > threshold ? 55 : Math.round(a[i + 1] * 0.25);
    heatmap[i + 2] = error > threshold ? 85 : Math.round(a[i + 2] * 0.25);
    heatmap[i + 3] = 255;
  }
  return {
    width,
    height,
    changedPixels,
    totalPixels: width * height,
    changedRatio: changedPixels / (width * height),
    meanAbsoluteError: sum / a.length,
    maxError,
    threshold,
    heatmap,
  };
}
