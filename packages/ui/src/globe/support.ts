/** True when this browser can give us a WebGL context, so the Live view globe can render.
 * Cheap and side-effect free: makes (and immediately discards) a detached canvas. */
export function isWebglSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}
