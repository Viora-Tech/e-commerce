/**
 * A request body as bytes, refused past `maxBytes`: first on the declared
 * `content-length`, then while streaming (a chunked body declares none), so an
 * oversized upload is never held in memory whole.
 */
export async function readCappedBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false }> {
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false }
  if (!request.body) return { ok: false }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return { ok: false }
    }
    chunks.push(value)
  }
  if (total === 0) return { ok: false }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, bytes }
}
