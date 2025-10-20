/**
 * Geometry helpers for rendering 2D sector/cone paths
 */

/**
 * Convert polar coordinates to cartesian
 * @param cx - Center X
 * @param cy - Center Y
 * @param r - Radius
 * @param angleRad - Angle in radians (0 = right/+x, positive = clockwise since y grows downward)
 * @returns Cartesian coordinates {x, y}
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleRad: number
): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/**
 * Generate an SVG path string for a circular sector (wedge/cone)
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param r - Radius of the sector
 * @param yaw - Center direction in radians (0 = right, positive clockwise)
 * @param pitch - Total aperture/width of the sector in radians
 * @returns SVG path string
 */
export function sectorPath(
  cx: number,
  cy: number,
  r: number,
  yaw: number,
  pitch: number
): string {
  // Handle edge case: zero or negative pitch
  if (pitch <= 0) {
    return `M ${cx} ${cy}`;
  }

  // Calculate start and end angles
  const startAngle = yaw - pitch / 2;
  const endAngle = yaw + pitch / 2;

  // Convert to cartesian coordinates
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);

  // Determine if we need a large arc (> 180 degrees)
  const largeArcFlag = pitch > Math.PI ? 1 : 0;

  // Build the SVG path:
  // M: Move to center
  // L: Line to start point on arc
  // A: Arc to end point (rx ry rotation large-arc-flag sweep-flag x y)
  // Z: Close path back to center
  const pathData = [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    `Z`,
  ].join(' ');

  return pathData;
}

