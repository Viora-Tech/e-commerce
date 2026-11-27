/** SOURCE OF TRUTH: labelProblemPage — the readable 4xx page `/api/shipments/<id>/label` answers
 * with when the courier cannot hand a label over. */
import { labelPageContent } from '@/data/label-sheet'
import { getCopy } from '@/lib/copy-server'

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * The courier could not hand the label over: a small page that says why, in a 4xx. A 502 here
 * was swapped by Cloudflare for its own "Bad gateway" page, so staff never saw the reason (#2503).
 * 409 when the courier has not made the label yet (try again later), 424 for any other courier
 * failure.
 */
export async function labelProblemPage(message: string, notReady: boolean): Promise<Response> {
  const copy = await getCopy(labelPageContent)
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(copy.title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#1a1a1a;background:#fff"><h1 style="font-size:1.25rem">${escapeHtml(copy.title)}</h1><p>${escapeHtml(message)}</p><p style="color:#666">${escapeHtml(copy.close)}</p></body></html>`
  return new Response(html, {
    status: notReady ? 409 : 424,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
