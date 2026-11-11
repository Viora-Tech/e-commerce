/**
 * TS vs Rust image pipeline, side by side on the same inputs.
 *
 *   bun services/image-worker/bench/make-inputs.ts      # once
 *   cargo build --release -j 1                           # in services/image-worker
 *   bun services/image-worker/bench/run.ts [--profile bulk] [--runs 2] [--only name] [--cpus 1]
 *
 * `--cpus n` pins each run to n cores (job affinity). Without it nothing caps the cores, as in
 * production today (the worker container has no CPU limit; sharp is set to one libvips thread,
 * but the interactive profile encodes every width at once on Bun's own threads).
 *
 * Every run goes through `measure` (bench/measure), which reports wall time, CPU time (so
 * cores used = cpu / wall) and peak RSS. Output files are compared with sharp: same dimensions,
 * PSNR and SSIM of Rust vs TS, and each one's PSNR against a lossless reference (the source,
 * auto-oriented and resized by sharp to the same size). Results: stdout, bench/.out/results-<mode>.md
 * and bench/.out/results-<mode>.json.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
// sharp is installed per package (isolated linker); borrow packages/core's copy, the one the pipeline uses.
import sharp from '../../../packages/core/node_modules/sharp'

const HERE = import.meta.dir
const CRATE = join(HERE, '..')
const OUT = join(HERE, '.out')
const INPUTS = join(OUT, 'inputs')
const EXE = process.platform === 'win32' ? '.exe' : ''
const MEASURE = join(CRATE, `target/release/measure${EXE}`)
const RUST = join(CRATE, `target/release/image-worker${EXE}`)

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const profile = arg('--profile') === 'bulk' ? 'bulk' : 'interactive'
const runs = Number(arg('--runs') ?? 2)
const only = arg('--only')
const cpus = arg('--cpus')
const mode = `${profile}${cpus ? `-${cpus}cpu` : ''}`

type Measured = {
  wallMs: number
  cpuMs: number
  cores: number
  peakRssMb: number
  peakTreeRssMb: number
  peakCommitMb: number
  exitCode: number
}
type Summary = {
  master: { key: string; contentType: string; bytes: number }
  width: number
  height: number
  thumbhash: string
  animated: boolean
  variants: {
    width: number
    avif: { key: string; bytes: number }
    webp: { key: string; bytes: number }
  }[]
}

const singleThreadEnv = {
  ...process.env,
  UV_THREADPOOL_SIZE: '1',
  VIPS_CONCURRENCY: '1',
  RAYON_NUM_THREADS: '1',
}

function measure(cmd: string[], tag: string): Measured {
  const json = join(OUT, `measure-${tag}.json`)
  const r = Bun.spawnSync(
    [MEASURE, '--json', json, ...(cpus ? ['--cpus', cpus] : []), '--', ...cmd],
    {
      env: singleThreadEnv,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  )
  const m = JSON.parse(readFileSync(json, 'utf8')) as Measured
  if (m.exitCode !== 0) throw new Error(`${cmd.join(' ')} failed: ${r.stderr.toString()}`)
  return m
}

/** Best of `runs` by wall time (the others were warming caches), keeping that run's memory. */
function bestOf(cmd: string[], tag: string): Measured {
  let best: Measured | undefined
  for (let i = 0; i < runs; i++) {
    const m = measure(cmd, `${tag}-${i}`)
    if (!best || m.wallMs < best.wallMs) best = m
  }
  return best as Measured
}

/** Decoded RGB, flattened on white (so transparent areas compare by what a shopper sees). */
async function pixels(file: string | Buffer, width?: number, height?: number) {
  let img = sharp(file).rotate()
  if (width && height) img = img.resize({ width, height, fit: 'fill' })
  const { data, info } = await img
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function psnr(a: Buffer, b: Buffer): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!
    sum += d * d
  }
  const mse = sum / a.length
  return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse)
}

/** Mean SSIM of the luma over 8x8 blocks. */
function ssim(a: Buffer, b: Buffer, width: number, height: number): number {
  const luma = (buf: Buffer, i: number) =>
    0.299 * buf[i]! + 0.587 * buf[i + 1]! + 0.114 * buf[i + 2]!
  const c1 = (0.01 * 255) ** 2
  const c2 = (0.03 * 255) ** 2
  let total = 0
  let blocks = 0
  for (let by = 0; by + 8 <= height; by += 8) {
    for (let bx = 0; bx + 8 <= width; bx += 8) {
      let ma = 0,
        mb = 0,
        va = 0,
        vb = 0,
        cov = 0
      for (let y = by; y < by + 8; y++) {
        for (let x = bx; x < bx + 8; x++) {
          const i = (y * width + x) * 3
          const la = luma(a, i)
          const lb = luma(b, i)
          ma += la
          mb += lb
          va += la * la
          vb += lb * lb
          cov += la * lb
        }
      }
      const n = 64
      ma /= n
      mb /= n
      va = va / n - ma * ma
      vb = vb / n - mb * mb
      cov = cov / n - ma * mb
      total += ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2))
      blocks++
    }
  }
  return blocks ? total / blocks : 1
}

type FileCompare = {
  file: string
  tsBytes: number
  rustBytes: number
  sameSize: boolean
  psnr: number
  ssim: number
  tsVsRef: number
  rustVsRef: number
}

async function compareFile(
  input: string,
  tsFile: string,
  rustFile: string,
  name: string,
): Promise<FileCompare> {
  const ts = await pixels(tsFile)
  const rust = await pixels(rustFile)
  const sameSize = ts.width === rust.width && ts.height === rust.height
  const ref = await pixels(input, ts.width, ts.height)
  return {
    file: name,
    tsBytes: statSync(tsFile).size,
    rustBytes: statSync(rustFile).size,
    sameSize,
    psnr: sameSize ? psnr(ts.data, rust.data) : 0,
    ssim: sameSize ? ssim(ts.data, rust.data, ts.width, ts.height) : 0,
    tsVsRef: psnr(ts.data, ref.data),
    rustVsRef: sameSize ? psnr(rust.data, ref.data) : 0,
  }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const kb = (n: number) => Math.round(n / 1024)

if (!existsSync(INPUTS)) throw new Error('run make-inputs.ts first')
if (!existsSync(RUST) || !existsSync(MEASURE))
  throw new Error('build the crate first: cargo build --release -j 1')

const SHARP_PATH = join(CRATE, '../../packages/core/node_modules/sharp').replaceAll('\\', '/')
const baseline = bestOf([process.execPath, '-e', `await import('${SHARP_PATH}')`], 'bun-baseline')
const results: Record<string, unknown>[] = []
const lines: string[] = []

for (const name of readdirSync(INPUTS).sort()) {
  if (only && !name.includes(only)) continue
  const input = join(INPUTS, name)
  const meta = await sharp(input).metadata()
  const tsDir = join(OUT, 'ts', name)
  const rustDir = join(OUT, 'rust', name)
  rmSync(tsDir, { recursive: true, force: true })
  rmSync(rustDir, { recursive: true, force: true })
  mkdirSync(tsDir, { recursive: true })
  mkdirSync(rustDir, { recursive: true })

  const ts = bestOf(
    [process.execPath, join(HERE, 'ts-process.ts'), input, '--out', tsDir, '--profile', profile],
    `ts-${name}`,
  )
  const rust = bestOf(
    [RUST, 'process', input, '--out', rustDir, '--profile', profile],
    `rust-${name}`,
  )
  const tsSum = JSON.parse(readFileSync(join(tsDir, 'result.json'), 'utf8')) as Summary
  const rustSum = JSON.parse(readFileSync(join(rustDir, 'result.json'), 'utf8')) as Summary

  const tsFiles = [
    tsSum.master.key,
    ...tsSum.variants.flatMap((v) => [v.avif.key, v.webp.key]),
  ].sort()
  const rustFiles = [
    rustSum.master.key,
    ...rustSum.variants.flatMap((v) => [v.avif.key, v.webp.key]),
  ].sort()
  const sameSet = JSON.stringify(tsFiles) === JSON.stringify(rustFiles)
  const compares: FileCompare[] = []
  for (const f of tsFiles) {
    if (rustFiles.includes(f))
      compares.push(await compareFile(input, join(tsDir, f), join(rustDir, f), f))
  }
  const of = (ext: string) => compares.filter((c) => c.file.endsWith(ext))
  const masters = compares.filter((c) => c.file === tsSum.master.key)
  const row = {
    image: name,
    input: `${meta.width}x${meta.height}`,
    inputKb: kb(statSync(input).size),
    master: `${tsSum.width}x${tsSum.height}`,
    sameFileSet: sameSet,
    sameDims:
      compares.every((c) => c.sameSize) &&
      tsSum.width === rustSum.width &&
      tsSum.height === rustSum.height,
    ts: {
      ...ts,
      masterKb: kb(sum(masters.map((c) => c.tsBytes))),
      avifKb: kb(sum(of('.avif').map((c) => c.tsBytes))),
      webpKb: kb(
        sum(
          of('.webp')
            .filter((c) => !masters.includes(c))
            .map((c) => c.tsBytes),
        ),
      ),
    },
    rust: {
      ...rust,
      masterKb: kb(sum(masters.map((c) => c.rustBytes))),
      avifKb: kb(sum(of('.avif').map((c) => c.rustBytes))),
      webpKb: kb(
        sum(
          of('.webp')
            .filter((c) => !masters.includes(c))
            .map((c) => c.rustBytes),
        ),
      ),
    },
    minPsnr: Math.min(...compares.map((c) => c.psnr)),
    minSsim: Math.min(...compares.map((c) => c.ssim)),
    avifVsRef: {
      ts: sum(of('.avif').map((c) => c.tsVsRef)) / Math.max(1, of('.avif').length),
      rust: sum(of('.avif').map((c) => c.rustVsRef)) / Math.max(1, of('.avif').length),
    },
    thumbhashEqual: tsSum.thumbhash === rustSum.thumbhash,
    files: compares,
  }
  results.push(row)
  const line = `| ${name} | ${row.input} | ${(ts.wallMs / 1000).toFixed(2)} / ${(rust.wallMs / 1000).toFixed(2)} | ${ts.cores.toFixed(2)} / ${rust.cores.toFixed(2)} | ${ts.peakRssMb.toFixed(0)} / ${rust.peakRssMb.toFixed(0)} | ${row.ts.masterKb} / ${row.rust.masterKb} | ${row.ts.avifKb} / ${row.rust.avifKb} | ${row.ts.webpKb} / ${row.rust.webpKb} | ${row.sameFileSet && row.sameDims ? 'yes' : 'NO'} | ${row.minPsnr.toFixed(1)} | ${row.minSsim.toFixed(3)} | ${row.avifVsRef.ts.toFixed(1)} / ${row.avifVsRef.rust.toFixed(1)} |`
  lines.push(line)
  console.log(line)
}

const header = [
  `Profile: ${profile}. Cores: ${cpus ? `pinned to ${cpus}` : 'not capped (sharp at 1 libvips thread, Rust single-threaded)'}. Best of ${runs} runs. Bun + sharp baseline (start, load sharp, exit): ${(baseline.wallMs / 1000).toFixed(2)} s, ${baseline.peakRssMb.toFixed(0)} MB peak RSS.`,
  '',
  '| Image | Input | Wall s (TS / Rust) | Cores (TS / Rust) | Peak RSS MB (TS / Rust) | Master KB | AVIF KB (all widths) | WebP KB (all widths) | Same files + dims | Min PSNR Rust vs TS dB | Min SSIM Rust vs TS | AVIF PSNR vs reference dB (TS / Rust) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
]
const md = [...header, ...lines].join('\n')
writeFileSync(join(OUT, `results-${mode}.md`), `${md}\n`)
writeFileSync(
  join(OUT, `results-${mode}.json`),
  JSON.stringify({ profile, cpus: cpus ?? null, runs, baseline, results }, null, 2),
)
console.log(`\n${md}`)
