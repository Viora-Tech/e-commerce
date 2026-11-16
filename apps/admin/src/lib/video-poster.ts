/**
 * A poster picture for an uploaded video, made in the browser: the frame about 2 s in, or the
 * next one that is not black or flat (a fade-in, a title card), so a hero video never shows a
 * black first frame before it plays (owner 16 Nov 2026). No server work: the browser already
 * decodes the video, and the frame is uploaded like any picture.
 */
import { isBlankPixels, isFeatureless } from './blank-image'

/** Seconds tried in order; the first that shows something wins. */
const TRIES = [2, 4, 1, 6, 0.5, 8]

/** The poster's long edge at most this many pixels: sharp on a full-width hero, not huge. */
const MAX_EDGE = 1920

/** Frames are judged on a copy this many pixels across (as `blank-image` does). */
const SAMPLE_WIDTH = 64

/** Give up on a video the browser cannot open or seek within this long. */
const WAIT_MS = 15_000

/** The times to try for a video this long: inside it, without repeats, the 2 s frame first. */
export function posterTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0]
  const last = Math.max(0, duration - 0.1)
  const times = TRIES.map((t) => Math.min(t, last))
  return [...new Set(times)]
}

/** True when a frame's sampled RGBA pixels show nothing worth a poster. */
export const frameIsEmpty = (data: ArrayLike<number>) => isBlankPixels(data) || isFeatureless(data)

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`video ${event} timed out`)), WAIT_MS)
    target.addEventListener(
      event,
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
    target.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        reject(new Error('video could not be read'))
      },
      { once: true },
    )
  })
}

function sample(video: HTMLVideoElement): Uint8ClampedArray | null {
  const height = Math.max(1, Math.round((SAMPLE_WIDTH * video.videoHeight) / video.videoWidth))
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, height)
  return ctx.getImageData(0, 0, SAMPLE_WIDTH, height).data
}

function encode(video: HTMLVideoElement, name: string): Promise<File | null> {
  const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], name, { type: 'image/jpeg' }) : null),
      'image/jpeg',
      0.85,
    ),
  )
}

/** `hero.mp4` → `hero-poster.jpg`. */
export const posterName = (videoName: string) =>
  `${videoName.replace(/\.[^.]+$/, '') || 'video'}-poster.jpg`

/**
 * The poster for a video file, as a JPEG ready to upload; null when the browser cannot read the
 * video. A video that is dark all through still gets its 2 s frame rather than nothing.
 */
export async function grabVideoPoster(file: File): Promise<File | null> {
  const src = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    const loaded = once(video, 'loadeddata')
    video.src = src
    await loaded
    if (!video.videoWidth || !video.videoHeight) return null
    let firstTime: number | null = null
    for (const time of posterTimes(video.duration)) {
      const seeked = once(video, 'seeked')
      video.currentTime = time
      await seeked
      firstTime ??= time
      const pixels = sample(video)
      if (pixels && !frameIsEmpty(pixels)) return encode(video, posterName(file.name))
    }
    if (firstTime === null) return null
    const back = once(video, 'seeked')
    video.currentTime = firstTime
    await back
    return encode(video, posterName(file.name))
  } catch {
    return null
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(src)
  }
}
