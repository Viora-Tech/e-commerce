/** Rejects javascript:, data:, vbscript: and friends. Relative URLs pass through. */
export function sanitizeHref(url: string): string {
  if (!url) return ''
  if (url.startsWith('/') || !url.includes(':')) return url
  try {
    const parsed = new URL(url, 'https://placeholder.invalid')
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? url : ''
  } catch {
    return ''
  }
}

/** Only http(s) and root-relative image sources are rendered. */
export function sanitizeImageSrc(src: string): string {
  if (src.startsWith('https://') || src.startsWith('http://')) return src
  if (src.startsWith('/') && !src.startsWith('//')) return src
  return ''
}

/** Blocks expression(), url(), var(), escapes and property terminators inside inline styles. */
export function sanitizeCssValue(value: string): string | undefined {
  if (!value) return undefined
  if (/expression\s*\(|url\s*\(|var\s*\(|env\s*\(|\\[0-9a-fA-F]|[;{}]/i.test(value))
    return undefined
  return value
}

export function isYouTubeId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{6,20}$/.test(id)
}
