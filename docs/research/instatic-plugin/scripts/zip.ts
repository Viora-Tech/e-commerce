import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { zipSync } from 'fflate'

const [src, out] = process.argv.slice(2)
const files: Record<string, Uint8Array> = {}
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p)
    else files[relative(src, p).split(sep).join('/')] = readFileSync(p)
  }
}
walk(src)
writeFileSync(out, zipSync(files))
console.log(Object.keys(files))
