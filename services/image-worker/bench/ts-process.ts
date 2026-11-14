/**
 * The TypeScript side of the comparison: runs today's `processImage` (packages/core, sharp) on one
 * file and writes the same files the Rust CLI writes, named the same way, plus `result.json`.
 *
 *   bun services/image-worker/bench/ts-process.ts <input> --out <dir> [--profile bulk] [--content-type t]
 *
 * Tuned like the production worker after #1471: one image core, one job (`tuneImagePipeline`),
 * so libvips runs one thread. Set UV_THREADPOOL_SIZE=1 as well (run.ts does).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { processImage, tuneImagePipeline } from '../../../packages/core/src/media/pipeline'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

const input = process.argv[2]
const out = arg('--out')
if (!input || !out) {
  console.error('usage: ts-process.ts <input> --out <dir> [--profile bulk] [--content-type t]')
  process.exit(2)
}
const profile = arg('--profile') === 'bulk' ? 'bulk' : 'interactive'
const contentType =
  arg('--content-type') ?? CONTENT_TYPES[extname(input).toLowerCase()] ?? 'image/jpeg'

tuneImagePipeline({ cpus: 1, jobs: 1 })
const bytes = new Uint8Array(await readFile(input))
const result = await processImage({ bytes, contentType, masterKey: basename(input), profile })

await mkdir(out, { recursive: true })
await writeFile(join(out, result.master.key), result.master.body)
for (const v of result.variants) {
  await writeFile(join(out, v.avif.key), v.avif.body)
  await writeFile(join(out, v.webp.key), v.webp.body)
}
const summary = {
  master: {
    key: result.master.key,
    contentType: result.master.contentType,
    bytes: result.master.body.byteLength,
  },
  width: result.width,
  height: result.height,
  thumbhash: result.thumbhash,
  animated: result.animated,
  variants: result.variants.map((v) => ({
    width: v.width,
    avif: { key: v.avif.key, bytes: v.avif.body.byteLength },
    webp: { key: v.webp.key, bytes: v.webp.body.byteLength },
  })),
}
await writeFile(join(out, 'result.json'), JSON.stringify(summary))
console.log(JSON.stringify(summary))
