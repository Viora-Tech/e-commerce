/**
 * Regenerates the app icons the platform consoles ask for (Meta app icon, Google OAuth consent
 * screen logo, Shopify app icon) from the K mark in apps/www/public/icon.svg.
 *
 *   bun integrations/assets/generate-icons.ts
 *
 * Uses the sharp that packages/core already depends on (no new dependency). Output: a white K
 * on the site's near-black (#151515), square, opaque, with padding so a round crop keeps it whole.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const require = createRequire(join(root, 'packages', 'core', 'package.json'))
const sharp = require('sharp') as typeof import('sharp')

const BACKGROUND = '#151515'
const MARK = '#fafafa'
/** Share of the icon the mark's box takes up; the rest is padding. */
const MARK_SCALE = 0.62

const SIZES = [
  { file: 'koomerce-icon-1200.png', size: 1200, use: 'Shopify app icon' },
  { file: 'koomerce-icon-1024.png', size: 1024, use: 'Meta app icon' },
  { file: 'koomerce-icon-512.png', size: 512, use: 'general / listing' },
  { file: 'koomerce-icon-120.png', size: 120, use: 'Google OAuth consent screen logo' },
]

const source = readFileSync(join(root, 'apps', 'www', 'public', 'icon.svg'), 'utf8')
const path = source.match(/<path[^>]*\sd="([^"]+)"/)?.[1]
const shift = source.match(/<path[^>]*transform="([^"]+)"/)?.[1] ?? ''
const box = Number(source.match(/viewBox="0 0 (\d+)/)?.[1] ?? 1110)
if (!path) throw new Error('No <path d> found in apps/www/public/icon.svg')

const offset = (box * (1 - MARK_SCALE)) / 2
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">
<rect width="${box}" height="${box}" fill="${BACKGROUND}"/>
<g transform="translate(${offset} ${offset}) scale(${MARK_SCALE})"><path transform="${shift}" fill="${MARK}" d="${path}"/></g>
</svg>`

for (const { file, size, use } of SIZES) {
  const out = join(import.meta.dir, file)
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`${file} (${size}x${size}) - ${use}`)
}
