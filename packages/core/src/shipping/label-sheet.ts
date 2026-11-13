/** SOURCE OF TRUTH: mergeLabelSheet
 * WHAT:  joins a batch's courier labels into one printable PDF in the merchant's chosen paper
 *        (4 × 6 in thermal, A4 four-up, or the courier's own pages).
 * WHY:   "Print 10 labels" after bulk booking is one file and one print dialog, not ten tabs in
 *        ten sizes.
 * WHERE: `printLabelSheet` (packages/api label-sheet.service.ts); layout maths in
 *        label-sheet-layout.ts.
 */
import { type LabelSheetFormat, labelSheetSize, layoutLabelPages } from './label-sheet-layout'

export type LabelFile = { id: string; bytes: Uint8Array }

const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff

/**
 * One PDF of every label page, in the files' order; `unreadable` lists the files that were
 * neither a PDF nor a PNG/JPEG image (left out rather than losing the others). `pdf` is null
 * when nothing was printable.
 */
export async function mergeLabelSheet(
  files: LabelFile[],
  format: LabelSheetFormat,
): Promise<{ pdf: Uint8Array | null; unreadable: string[] }> {
  // pdf-lib loads here, when someone prints, not with every process that loads core.
  const { PDFDocument, degrees } = await import('pdf-lib')
  const out = await PDFDocument.create()
  const unreadable: string[] = []
  /** Every label page, embedded, with its own size. */
  type Source =
    | {
        kind: 'page'
        embed: Awaited<ReturnType<typeof out.embedPage>>
        width: number
        height: number
      }
    | {
        kind: 'image'
        embed: Awaited<ReturnType<typeof out.embedPng>>
        width: number
        height: number
      }
  const sources: Source[] = []

  for (const file of files) {
    try {
      if (isPng(file.bytes) || isJpeg(file.bytes)) {
        const embed = isPng(file.bytes)
          ? await out.embedPng(file.bytes)
          : await out.embedJpg(file.bytes)
        if (format === 'original') {
          const page = out.addPage([embed.width, embed.height])
          page.drawImage(embed, { x: 0, y: 0, width: embed.width, height: embed.height })
        } else {
          sources.push({ kind: 'image', embed, width: embed.width, height: embed.height })
        }
        continue
      }
      const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true })
      if (format === 'original') {
        const pages = await out.copyPages(src, src.getPageIndices())
        for (const page of pages) out.addPage(page)
        continue
      }
      // A page with no drawing (a courier's blank trailer page) cannot be embedded, and pdf-lib
      // only finds out when saving: leave it out here instead.
      const drawn = src.getPages().filter((p) => p.node.Contents() !== undefined)
      if (drawn.length === 0) throw new Error('No label page')
      const embeds = await out.embedPages(drawn)
      for (const embed of embeds) {
        sources.push({ kind: 'page', embed, width: embed.width, height: embed.height })
      }
    } catch {
      unreadable.push(file.id)
    }
  }

  const size = labelSheetSize(format)
  if (size) {
    const { sheets, placements } = layoutLabelPages(sources, format)
    const pages = Array.from({ length: sheets }, () => out.addPage([size.width, size.height]))
    placements.forEach((at, i) => {
      const source = sources[i]
      const page = pages[at.sheet]
      if (!source || !page) return
      // Turned a quarter anticlockwise about its origin, the page spans x - height … x: start
      // at the footprint's right edge.
      const x = at.rotate ? at.x + at.width : at.x
      const options = {
        x,
        y: at.y,
        width: source.width * at.scale,
        height: source.height * at.scale,
        rotate: degrees(at.rotate ? 90 : 0),
      }
      if (source.kind === 'page') page.drawPage(source.embed, options)
      else page.drawImage(source.embed, options)
    })
  }

  if (out.getPageCount() === 0) return { pdf: null, unreadable }
  return { pdf: await out.save(), unreadable }
}
