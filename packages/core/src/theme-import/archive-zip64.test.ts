import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readThemeArchive, ThemeArchiveProblem } from './archive'

const THEME = {
  'layout/theme.liquid': strToU8('<html>{{ content_for_layout }}</html>'),
  'templates/index.json': strToU8('{"sections":{},"order":[]}'),
}

const u16 = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0

/** Rewrites a zip the way Shopify's exports look: real sizes only in a ZIP64 extra field. */
function asShopifyExport(zip: Uint8Array, reportedSize?: number): Uint8Array {
  let end = zip.length - 22
  while (u32(zip, end) !== 0x06054b50) end--
  const count = u16(zip, end + 10)
  const start = u32(zip, end + 16)
  const parts: Uint8Array[] = []
  let at = start
  for (let n = 0; n < count; n++) {
    const nameLength = u16(zip, at + 28)
    const length = 46 + nameLength + u16(zip, at + 30) + u16(zip, at + 32)
    const entry = zip.slice(at, at + length)
    const view = new DataView(entry.buffer)
    const extra = new DataView(new ArrayBuffer(20))
    extra.setUint16(0, 0x0001, true)
    extra.setUint16(2, 16, true)
    extra.setBigUint64(4, BigInt(reportedSize ?? u32(zip, at + 24)), true)
    extra.setBigUint64(12, BigInt(u32(zip, at + 20)), true)
    view.setUint32(20, 0xffffffff, true)
    view.setUint32(24, 0xffffffff, true)
    view.setUint16(30, 20, true)
    parts.push(entry.slice(0, 46 + nameLength), new Uint8Array(extra.buffer))
    at += length
  }
  const directory = parts.reduce((sum, p) => sum + p.length, 0)
  const tail = zip.slice(end)
  new DataView(tail.buffer).setUint32(12, directory, true)
  const out = new Uint8Array(start + directory + tail.length)
  out.set(zip.subarray(0, start))
  let write = start
  for (const part of parts) {
    out.set(part, write)
    write += part.length
  }
  out.set(tail, write)
  return out
}

describe('readThemeArchive with ZIP64 sizes', () => {
  it('reads a Shopify export', () => {
    const archive = readThemeArchive(asShopifyExport(zipSync(THEME)))
    expect([...archive.files.keys()].sort()).toEqual(Object.keys(THEME).sort())
    expect(archive.skipped).toEqual([])
  })

  it('still stops an entry that inflates past the size it declared', () => {
    const big = zipSync({ ...THEME, 'assets/a.js': [new Uint8Array(1 << 20), { level: 9 }] })
    expect(() => readThemeArchive(asShopifyExport(big, 10))).toThrow(ThemeArchiveProblem)
  })

  it('still skips a file over the limit', () => {
    const zip = asShopifyExport(zipSync(THEME), 16 * 1024 * 1024)
    expect(() => readThemeArchive(zip)).toThrow(ThemeArchiveProblem)
  })
})
