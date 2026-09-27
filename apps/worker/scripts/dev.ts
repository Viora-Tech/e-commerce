/**
 * Dev supervisor for the worker: runs `src/index.ts` and restarts it when the worker or any
 * workspace package it depends on (transitively) changes.
 *
 * Why not `bun --watch`: on Windows Bun only watches the directory it was started in, so edits
 * in `packages/*` are skipped ("not in the project directory and will not be watched") and the
 * worker keeps running stale code. This watches each workspace package folder directly with
 * `fs.watch`, which works the same on Windows, macOS and Linux: `src/` recursively (all runtime
 * code lives there) and the folder itself, not recursively, for `package.json`. Package roots
 * are never watched recursively because their `node_modules` exhausts file handles. The child
 * keeps `apps/worker` as its cwd, as `bun run start` does.
 */
import { existsSync, type FSWatcher, readFileSync, watch } from 'node:fs'
import path from 'node:path'

type Manifest = {
  name: string
  dependencies?: Record<string, string>
  workspaces?: string[]
}

const RESTART_DEBOUNCE_MS = 150
const STOP_TIMEOUT_MS = 10_000
const WATCHED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'])
const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', '.turbo', 'coverage', '.next'])

/** Folders of `start` and every workspace package it reaches through `workspace:` dependencies. */
export function workspaceClosure(
  start: string,
  packages: Map<string, { dir: string; manifest: Manifest }>,
): string[] {
  const seen = new Set<string>()
  const queue = [start]
  while (queue.length > 0) {
    const name = queue.shift() as string
    const pkg = packages.get(name)
    if (!pkg || seen.has(name)) continue
    seen.add(name)
    for (const [dep, range] of Object.entries(pkg.manifest.dependencies ?? {})) {
      if (range.startsWith('workspace:')) queue.push(dep)
    }
  }
  return [...seen].map((name) => packages.get(name)?.dir as string)
}

/** Whether a changed file (relative to a watched package folder) should restart the worker. */
export function shouldRestart(file: string): boolean {
  const parts = file.split(/[\\/]/)
  if (parts.some((part) => IGNORED_SEGMENTS.has(part))) return false
  const base = parts[parts.length - 1] ?? ''
  if (/\.test\.tsx?$/.test(base)) return false
  return WATCHED_EXTENSIONS.has(path.extname(base))
}

function readManifest(file: string): Manifest {
  return JSON.parse(readFileSync(file, 'utf8')) as Manifest
}

function loadWorkspace(root: string): Map<string, { dir: string; manifest: Manifest }> {
  const packages = new Map<string, { dir: string; manifest: Manifest }>()
  for (const pattern of readManifest(path.join(root, 'package.json')).workspaces ?? []) {
    for (const file of new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: root })) {
      const manifest = readManifest(path.join(root, file))
      packages.set(manifest.name, { dir: path.join(root, path.dirname(file)), manifest })
    }
  }
  return packages
}

async function main() {
  const workerDir = path.resolve(import.meta.dir, '..')
  const root = path.resolve(workerDir, '../..')
  const self = readManifest(path.join(workerDir, 'package.json')).name
  const dirs = workspaceClosure(self, loadWorkspace(root))

  let child: ReturnType<typeof Bun.spawn> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let restarting = false
  let pending = false

  const start = () => {
    child = Bun.spawn([process.execPath, '--env-file=../../.env', 'src/index.ts'], {
      cwd: workerDir,
      stdio: ['inherit', 'inherit', 'inherit'],
    })
  }

  const stop = async () => {
    const running = child
    child = null
    if (!running || running.exitCode !== null || running.signalCode !== null) return
    running.kill('SIGTERM')
    const killer = setTimeout(() => running.kill('SIGKILL'), STOP_TIMEOUT_MS)
    await running.exited
    clearTimeout(killer)
  }

  const restart = async (reason: string) => {
    if (restarting) {
      pending = true
      return
    }
    restarting = true
    console.log(`[worker:dev] ${reason} changed, restarting`)
    await stop()
    start()
    restarting = false
    if (pending) {
      pending = false
      await restart('more files')
    }
  }

  const onChange = (folder: string) => (_event: string, file: string | null) => {
    if (!file || !shouldRestart(String(file))) return
    const changed = path.relative(root, path.join(folder, String(file)))
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void restart(changed), RESTART_DEBOUNCE_MS)
  }

  const watchers: FSWatcher[] = dirs.flatMap((dir) => {
    const src = path.join(dir, 'src')
    return [
      watch(dir, onChange(dir)),
      ...(existsSync(src) ? [watch(src, { recursive: true }, onChange(src))] : []),
    ]
  })

  const exit = async () => {
    for (const watcher of watchers) watcher.close()
    await stop()
    process.exit(0)
  }
  process.on('SIGINT', exit)
  process.on('SIGTERM', exit)

  console.log(`[worker:dev] watching ${dirs.length} workspace packages`)
  start()
}

if (import.meta.main) await main()
