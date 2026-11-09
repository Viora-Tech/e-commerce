/**
 * Run `admin-pages.ts` over every admin route in chunks, restarting `next dev` between chunks.
 * A dev server keeps every route it has compiled in memory (3 GB after a dozen pages), so on a
 * small machine one long run runs out of RAM. Each chunk starts a fresh server (Turbopack's disk
 * cache keeps restarts quick), measures `--chunk` pages, then stops the server.
 *
 *   bun run --env-file=.env scripts/perf/admin-pages-chunked.ts --port 3290 \
 *     --out docs/research/x.csv [--chunk 12] [--runs 2] [--only "regex"]
 *
 * Other flags are passed through to admin-pages.ts. Resumes where the CSV left off.
 */
import { spawn, spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const opt = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? (argv[i + 1] ?? fallback) : fallback
}
const PORT = opt('--port', '3290')
const CHUNK = opt('--chunk', '4')
const CHECKOUT = resolve(opt('--checkout', '.'))
const OWN = ['--port', '--chunk', '--checkout', '--only']
/** Handed on as PERF_ONLY: through cmd.exe (Windows) a | in an argument would be a pipe. */
const ONLY = argv.includes('--only') ? opt('--only', '') : undefined
const pass = argv.filter((a, i) => !OWN.includes(a) && !OWN.includes(argv[i - 1] ?? ''))
const SCRIPT = join(import.meta.dir, 'admin-pages.ts')

function stop(pid: number | undefined) {
  if (!pid) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)])
  else process.kill(-pid, 'SIGTERM')
}

async function waitReady(): Promise<void> {
  for (let i = 0; i < 300; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/login`)
      if (res.status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('admin dev server did not start')
}

for (let round = 0; round < 100; round++) {
  const dev = spawn('bunx', ['next', 'dev', '--port', PORT], {
    cwd: join(CHECKOUT, 'apps/admin'),
    env: process.env,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
  })
  try {
    await waitReady()
    const run = spawnSync(
      'bun',
      [
        SCRIPT,
        '--base',
        `http://localhost:${PORT}`,
        '--append',
        '--skip-done',
        '--max',
        CHUNK,
        ...pass,
      ],
      {
        stdio: ['ignore', 'pipe', 'inherit'],
        encoding: 'utf8',
        env: ONLY ? { ...process.env, PERF_ONLY: ONLY } : process.env,
      },
    )
    process.stdout.write(run.stdout ?? '')
    if ((run.stdout ?? '').includes('ALL ROUTES DONE')) break
    if (run.status !== 0) throw new Error(`admin-pages.ts exited ${run.status}`)
  } finally {
    stop(dev.pid)
    await new Promise((r) => setTimeout(r, 3000))
  }
}
