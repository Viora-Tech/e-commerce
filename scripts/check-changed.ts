/**
 * `bun run check:changed [base]`: the quick check for a change, instead of the whole repo.
 * Looks at the files changed since `base` (default origin/dev; committed, staged, unstaged and
 * new) and runs, in order, stopping at the first failure:
 *   1. biome on those files only;
 *   2. tsc on the packages they are in and every workspace package that depends on them
 *      (incremental: a second run on the same package only rechecks what changed);
 *   3. vitest `related` in each package: only the tests that import a changed file;
 *   4. the component structure checker, when a .tsx changed.
 * `--no-test` skips step 3. The full `bun run lint`, `typecheck`, `test` and build still run
 * once on dev before a release (docs/handoff: "Test on dev").
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dir, '..')
const args = process.argv.slice(2)
const noTest = args.includes('--no-test')
const base = args.find((a) => !a.startsWith('--')) ?? 'origin/dev'

type Pkg = { name: string; dir: string; deps: string[]; scripts: Record<string, string> }

function git(...cmd: string[]): string[] {
  const r = spawnSync('git', cmd, { cwd: ROOT, encoding: 'utf8' })
  return r.status === 0
    ? r.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : []
}

function changedFiles(): string[] {
  const all = new Set([
    ...git('diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`),
    ...git('diff', '--name-only', '--diff-filter=ACMR', 'HEAD'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ])
  return [...all].filter((f) => existsSync(path.join(ROOT, f)))
}

function workspaces(): Pkg[] {
  return ['apps', 'packages'].flatMap((group) =>
    readdirSync(path.join(ROOT, group), { withFileTypes: true }).flatMap((d) => {
      const dir = `${group}/${d.name}`
      const file = path.join(ROOT, dir, 'package.json')
      if (!d.isDirectory() || !existsSync(file)) return []
      const json = JSON.parse(readFileSync(file, 'utf8'))
      const deps = { ...json.dependencies, ...json.devDependencies }
      return [
        {
          name: json.name as string,
          dir,
          deps: Object.keys(deps).filter((k) => String(deps[k]).startsWith('workspace:')),
          scripts: json.scripts ?? {},
        },
      ]
    }),
  )
}

/** The packages holding `files`, plus everything that depends on them (transitively). */
function affected(pkgs: Pkg[], files: string[]): { touched: Pkg[]; withDependents: Pkg[] } {
  const touched = pkgs.filter((p) => files.some((f) => f.startsWith(`${p.dir}/`)))
  const names = new Set(touched.map((p) => p.name))
  let grew = true
  while (grew) {
    grew = false
    for (const p of pkgs) {
      if (!names.has(p.name) && p.deps.some((d) => names.has(d))) {
        names.add(p.name)
        grew = true
      }
    }
  }
  return { touched, withDependents: pkgs.filter((p) => names.has(p.name)) }
}

function run(label: string, cmd: string, cmdArgs: string[], cwd = ROOT): boolean {
  const started = performance.now()
  process.stdout.write(`\n▶ ${label}\n`)
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  const secs = ((performance.now() - started) / 1000).toFixed(1)
  const ok = r.status === 0
  process.stdout.write(`${ok ? '✓' : '✗'} ${label} (${secs}s)\n`)
  return ok
}

function main(): number {
  const files = changedFiles()
  if (!files.length) {
    console.log(`Nothing changed since ${base}.`)
    return 0
  }
  console.log(`${files.length} changed file(s) since ${base}.`)
  const pkgs = workspaces()
  const { touched, withDependents } = affected(pkgs, files)

  const lintable = files.filter((f) => /\.(m?[jt]sx?|json|jsonc|css)$/.test(f))
  if (lintable.length && !run('biome (changed files)', 'bunx', ['biome', 'check', ...lintable])) {
    return 1
  }

  for (const p of withDependents) {
    if (!existsSync(path.join(ROOT, p.dir, 'tsconfig.json'))) continue
    const info = 'node_modules/.cache/check-changed.tsbuildinfo'
    const tsc = ['tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', info, '-p', '.']
    if (!run(`tsc ${p.name}`, 'bunx', tsc, path.join(ROOT, p.dir))) return 1
  }

  if (!noTest) {
    for (const p of touched) {
      if (!p.scripts.test?.includes('vitest')) continue
      const mine = files
        .filter((f) => f.startsWith(`${p.dir}/`) && /\.(m?[jt]sx?)$/.test(f))
        .map((f) => f.slice(p.dir.length + 1))
      if (!mine.length) continue
      const vitest = ['vitest', 'related', '--run', '--passWithNoTests', ...mine]
      if (!run(`vitest related ${p.name}`, 'bunx', vitest, path.join(ROOT, p.dir))) return 1
    }
  }

  if (files.some((f) => f.endsWith('.tsx'))) {
    if (!run('component structure', 'bun', ['scripts/check-components.ts'])) return 1
  }
  console.log('\nAll checks for the changed files passed.')
  return 0
}

process.exit(main())
