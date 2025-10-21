"use client";

export type CartesianPoint = { x: number; y: number };

export function polarToCartesian(cx: number, cy: number, r: number, angleRad: number): CartesianPoint {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

// Returns an SVG path for a circular sector centered at (cx, cy)
// with radius r, centered at yaw, spanning total angle pitch.
export function sectorPath(
  cx: number,
  cy: number,
  r: number,
  yaw: number,
  pitch: number
): string {
  const half = pitch / 2;
  const startAngle = yaw - half;
  const endAngle = yaw + half;

  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);

  // large-arc-flag if angle > 180deg
  const largeArcFlag = pitch > Math.PI ? 1 : 0;
  const sweepFlag = 1; // clockwise

  // Move to center, line to arc start, arc to end, close to center
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y} Z`;
}

export default sectorPath;

