/** Screen-space position of a globe pin, in client pixels. */
export type GlobePin = { id: string; x: number; y: number }

/** What the hero globe lets the build sequence do. Filled in by the WebGL globe once it runs. */
export type GlobeApi = {
  /** Turns the globe to India, zooms slightly and holds it there. */
  focusIndia: () => void
  /** Lets it go again: auto-rotate resumes after a short pause. */
  release: () => void
  /** Pins currently on the visible side of the globe. */
  visiblePins: () => GlobePin[]
}
