/**
 * Server rendering: fonts from the package's `fonts/` directory on disk,
 * `renderToBuffer` for one document, pdf-lib to merge many into one print
 * file, and fflate to zip them for bulk download.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToBuffer } from '@react-pdf/renderer'
import { zipSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { documentElement, type TemplateProps } from '../templates'
import { registerFonts } from './fonts'

/**
 * `fonts/` beside `src/`. Bundlers that move this file (Next server chunks)
 * set INVOICE_FONTS_DIR to the package's fonts directory instead.
 */
export function fontsDir(): string {
  const candidates = [
    process.env.INVOICE_FONTS_DIR,
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fonts'),
    // Next apps run from apps/<name>; the worker and tests from their package.
    join(process.cwd(), '..', '..', 'packages', 'invoices', 'fonts'),
    join(process.cwd(), 'packages', 'invoices', 'fonts'),
  ]
  const hit = candidates.find((dir) => dir && existsSync(join(dir, 'inter', 'Inter-Regular.ttf')))
  if (!hit) throw new Error('invoice fonts not found; set INVOICE_FONTS_DIR')
  return hit
}

export async function renderDocumentToBuffer(props: TemplateProps): Promise<Uint8Array> {
  const dir = fontsDir()
  registerFonts((file) => join(dir, file))
  const buf = await renderToBuffer(documentElement(props))
  return new Uint8Array(buf)
}

/** One PDF holding every page of `files`, in order: bulk print. */
export async function mergePdfs(files: readonly Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
  }
  return out.save()
}

/** A zip of named files: bulk download. PDFs are already compressed, so store them. */
export function zipFiles(files: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const used = new Map<string, number>()
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const f of files) {
    const base = f.name.replace(/[/:*?"<>|]+/g, '-')
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const name = n ? base.replace(/(\.pdf)?$/, `-${n + 1}$1`) : base
    entries[name] = [f.bytes, { level: 0 }]
  }
  return zipSync(entries)
}
