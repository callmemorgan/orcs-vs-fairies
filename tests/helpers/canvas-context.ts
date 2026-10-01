/** DOM interaction tests do not rasterize; browser proofs inspect real canvas pixels. */
export function canvasContextStub():CanvasRenderingContext2D {
  return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},rect(){},arc(){}} as unknown as CanvasRenderingContext2D;
}
