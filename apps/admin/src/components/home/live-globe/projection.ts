/**
 * The lat/lng <-> phi/theta maths a cobe globe needs: which rotation faces a given point at
 * the viewer (to ease the camera onto India on load), and where a point lands on screen for
 * the current rotation (to place the tooltip and the accessible marker buttons over it).
 * Cobe does not expose either itself; this follows the projection its own demos use.
 */

export type ScreenPoint = { x: number; y: number; visible: boolean }

/** The globe's `phi`/`theta` state that centres `lat`/`lng` facing the viewer. */
export function locationToAngles(lat: number, lng: number): [phi: number, theta: number] {
  return [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180]
}

/** A point on the unit sphere for `lat`/`lng`, before the globe's own rotation is applied. */
function toUnitVector(lat: number, lng: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  return [
    Math.cos(latRad) * Math.sin(lngRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.cos(lngRad),
  ]
}

/**
 * `lat`/`lng` -> a point in [-1, 1] x [-1, 1] view space for the globe's current `phi`
 * (spin) and `theta` (tilt), with `visible: false` once it has rotated onto the far side.
 * Multiply x/y by the canvas radius and flip y for screen (CSS) pixels.
 */
export function projectToView(lat: number, lng: number, phi: number, theta: number): ScreenPoint {
  const [vx, vy, vz] = toUnitVector(lat, lng)
  // Spin around the vertical axis by phi.
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const x1 = vx * cosPhi + vz * sinPhi
  const z1 = vz * cosPhi - vx * sinPhi
  // Tilt around the horizontal axis by theta.
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const y2 = vy * cosTheta - z1 * sinTheta
  const z2 = vy * sinTheta + z1 * cosTheta
  return { x: x1, y: y2, visible: z2 > -0.12 }
}
