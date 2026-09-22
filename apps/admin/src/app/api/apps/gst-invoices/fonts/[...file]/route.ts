import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FONT_FILES } from '@commerce/invoices/pdf'
import { fontsDir } from '@commerce/invoices/render'

const ALLOWED: Set<string> = new Set(
  Object.values(FONT_FILES).flatMap((weights) => Object.values(weights)),
)

/**
 * The vendored invoice fonts (SIL OFL), for the settings live preview.
 * Only files the PDF font table names are served; nothing else in the folder.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const rel = (await params).file.join('/')
  if (!ALLOWED.has(rel)) return new Response('Not found', { status: 404 })
  const bytes = await readFile(join(fontsDir(), rel))
  return new Response(bytes, {
    headers: {
      'content-type': 'font/ttf',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
