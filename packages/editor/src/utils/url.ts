const SUPPORTED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:'])

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!SUPPORTED_URL_PROTOCOLS.has(parsed.protocol)) return 'about:blank'
  } catch {
    return url
  }
  return url
}

const URL_REGEX =
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w\-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\w]*))?)/

/** "https://" alone is allowed so a link can be created before the URL is typed. */
export function validateUrl(url: string): boolean {
  return url === 'https://' || URL_REGEX.test(url)
}

const YOUTUBE_REGEX = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/

/** Accepts a full YouTube URL or a bare 11-character id. */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  const match = trimmed.match(YOUTUBE_REGEX)
  return match?.[2]?.length === 11 ? match[2] : null
}
