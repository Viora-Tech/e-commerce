/**
 * Reading a download for the media host (media.ts): count and cap it, read it
 * whole into one buffer, or peek at its first bytes and hand it on again, and
 * tell its type from those bytes. Web streams read with our own readers, never
 * piped: the worker runs on Bun, whose stream piping crashed the process.
 */

/** Bytes that make the type of a body recognisable (`sniffContentType`). */
const SNIFF_BYTES = 16

/**
 * The body again, calling `onChunk` for each chunk and failing once more than
 * `limit` bytes have arrived. Counts what fetch hands over (decompressed), never
 * what the headers said.
 *
 * Read chunk by chunk with our own reader, never `pipeThrough`/`pipeTo`: Bun's
 * built-in stream piping threw "undefined is not a function" outside any promise
 * at the end of a video copy on the test server and killed the worker (twice).
 */
export function metered(
  body: ReadableStream<Uint8Array>,
  limit: number,
  onChunk: (bytes: number) => void,
  tooLarge: () => Error,
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  let seen = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) return controller.close()
      seen += value.byteLength
      onChunk(value.byteLength)
      if (seen > limit) {
        await reader.cancel().catch(() => {})
        controller.error(tooLarge())
        return
      }
      controller.enqueue(value)
    },
    cancel: (reason) => reader.cancel(reason),
  })
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1 && chunks[0]?.byteLength === total) return chunks[0]
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}

/**
 * The whole body, or null once it passes `limit` bytes (the download is then
 * cancelled). With the size known up front the bytes go straight into one buffer
 * of that size, so a 50 MB image is never held twice while it is put together.
 */
export async function readAll(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  onChunk: () => void,
  expected: number | null,
): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  let into =
    expected !== null && expected > 0 && expected <= limit ? new Uint8Array(expected) : null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk()
    const at = total
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => {})
      return null
    }
    if (into && total <= into.byteLength) {
      into.set(value, at)
      continue
    }
    // More than the source said: carry on in pieces.
    if (into) chunks.push(into.subarray(0, at))
    into = null
    chunks.push(value)
  }
  if (into) return total === into.byteLength ? into : into.subarray(0, total)
  return concat(chunks, total)
}

/**
 * The first bytes of a body (to recognise its type) and the body again, whole,
 * as if nothing had been read: it can still stream into the bucket.
 */
export async function peek(
  body: ReadableStream<Uint8Array>,
  onChunk: () => void,
): Promise<{ head: Uint8Array; body: ReadableStream<Uint8Array> }> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let ended = false
  while (total < SNIFF_BYTES) {
    const { done, value } = await reader.read()
    if (done) {
      ended = true
      break
    }
    onChunk()
    chunks.push(value)
    total += value.byteLength
  }
  const head = concat(chunks, total)
  let replayed = false
  const again = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!replayed) {
        replayed = true
        if (head.byteLength) controller.enqueue(head)
        if (ended) controller.close()
        return
      }
      const { done, value } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel: (reason) => reader.cancel(reason),
  })
  return { head, body: again }
}

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to))

/**
 * What the bytes say they are (magic numbers), for a response whose own
 * content type is not one we accept. The URL's extension is never trusted:
 * `…/latest/meta-data.mp4` redirected somewhere internal would otherwise be
 * stored as video. ISO BMFF (`ftyp`) covers AVIF, HEIC, MP4 and QuickTime.
 */
export function sniffContentType(bytes: Uint8Array): string | null {
  const [b0, b1, b2, b3] = bytes
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return 'image/jpeg'
  if (b0 === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'image/png'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'image/gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
  if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) return 'video/webm'
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand))
      return 'image/heic'
    if (brand === 'qt  ') return 'video/quicktime'
    return 'video/mp4'
  }
  return null
}
