/**
 * "Report a bug": a picture of what the member sees, taken with modern-screenshot (MIT,
 * THIRD_PARTY_NOTICES.md) BEFORE the dialog opens, so the dialog is not in it. The library is
 * loaded only when a picture is taken. Browser only.
 */

/** The server's limit (`SCREENSHOT_MAX_BYTES` in the API). */
const MAX_BYTES = 2 * 1024 * 1024

/** Elements that never belong in the picture: marked ones and password fields. */
const SKIP_IN_SCREENSHOT = 'data-screenshot-skip'

function keep(node: Node): boolean {
  if (!(node instanceof Element)) return true
  if (node.hasAttribute(SKIP_IN_SCREENSHOT)) return false
  if (node instanceof HTMLInputElement && node.type === 'password') return false
  // Next's dev tools badge lives in its own element; it is not part of the page.
  return node.tagName.toLowerCase() !== 'nextjs-portal'
}

/** Decoded size of a base64 data URL. */
function bytesOf(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

/** Lets a closing menu or tooltip finish leaving before the picture is taken. */
async function settle(): Promise<void> {
  // Spinners and live dots never finish, so this waits at most 400ms. No requestAnimationFrame:
  // it never fires in a background tab, which would leave the button spinning.
  const leaving = document.getAnimations().map((a) => a.finished.catch(() => undefined))
  await Promise.race([Promise.all(leaving), new Promise((r) => setTimeout(r, 400))])
}

/**
 * The visible page as a PNG data URL, or a JPEG when the PNG would be over 2 MB. Null when it
 * cannot be taken (the report is still worth sending).
 */
export async function capturePage(): Promise<string | null> {
  try {
    await settle()
    const { domToJpeg, domToPng } = await import('modern-screenshot')
    const node = document.body
    const options = {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: getComputedStyle(node).backgroundColor,
      filter: keep,
    }
    const png = await domToPng(node, {
      ...options,
      scale: Math.min(window.devicePixelRatio || 1, 2),
    })
    if (bytesOf(png) <= MAX_BYTES) return png
    for (const quality of [0.85, 0.7, 0.5]) {
      const jpeg = await domToJpeg(node, { ...options, scale: 1, quality })
      if (bytesOf(jpeg) <= MAX_BYTES) return jpeg
    }
    return null
  } catch (err) {
    // Lands in the report's recent errors too, which is where whoever reads it needs it.
    console.error('Screenshot failed:', err)
    return null
  }
}
