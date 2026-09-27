/**
 * YouTube and Vimeo links as privacy-friendly embed URLs, or null for anything
 * else (which then plays as a video file). Shared by the Video section and the
 * Video element.
 */
export function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

/** A video file URL only when it is a web address; anything else plays nothing. */
export const safeVideoFile = (url: string): string | null =>
  /^https?:\/\//i.test(url.trim()) || /^\/(?!\/)/.test(url.trim()) ? url.trim() : null
