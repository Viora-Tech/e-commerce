/**
 * `bun scripts/prebuild-packages.ts`: compiles the server-side workspace packages to plain
 * JavaScript before `next build`, so Turbopack reads small per-file JS instead of the raw
 * TypeScript sources. Only the production image build runs it (apps/admin/Dockerfile,
 * apps/storefront/Dockerfile); `bun run dev`, the editor, tests and typecheck keep using `src/`.
 *
 * For each package under packages/ that is not in KEEP_SOURCE:
 * - every `src/**\/*.ts` is compiled on its own with TypeScript's `transpileModule` (types
 *   stripped, nothing else: directives, comments, `process.env`, `import.meta` stay as written)
 *   to the same path under `dist/`, so paths relative to the file (`new URL('../drizzle',
 *   import.meta.url)`, the invoice fonts) point at the same place;
 * - relative imports get their real extension (`./a` → `./a.js`, `./b/index.js`), so the output
 *   is valid ESM on its own;
 * - `.tsx` files (JSX) and every other file are copied unchanged, so Next still compiles JSX
 *   with the React Compiler exactly as today;
 * - `package.json` `exports` that point into `./src/` are pointed at `./dist/` (the original
 *   is saved in `dist/.source-exports.json`; `--revert` puts it back and removes `dist/`).
 *
 * `--dry` compiles to `dist/` without touching package.json. `BUILD_PREBUILT=0` makes the script
 * do nothing (the build then compiles every package from source, as before). Both apps'
 * next.config.ts drop packages whose exports point at `dist/` from `transpilePackages`
 * (`dropPrebuilt` in packages/config/src/lean-build.ts).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

/**
 * Packages left as source: client React code. Compiling them ahead of time would take their
 * hooks (in `.ts` files too) out of the React Compiler, which only Next runs.
 */
export const KEEP_SOURCE: Record<string, string> = {
  '@commerce/ui': "client components and hooks ('use client'); needs the React Compiler",
  '@commerce/blocks': "storefront sections ('use client') and CSS; needs the React Compiler",
  '@commerce/editor': "theme editor ('use client'); needs the React Compiler",
  '@commerce/richtext': 'React renderers shared by client and server',
}

const ROOT = path.resolve(import.meta.dirname, '..')
const MARKER = '.source-exports.json'
const TEST_FILE = /\.(test|spec)\.tsx?$|\.d\.ts$/
/**
 * A React hook in a .ts file: a `useX(` call in a file that imports React, a Next client module
 * or a KEEP_SOURCE package (a test helper named `useWorkerDatabase` is not one). Prebuilt, it
 * would skip the React Compiler.
 */
const HOOK_CALL = /\buse[A-Z][A-Za-z0-9]*\s*\(/
const REACT_IMPORT =
  /\bfrom\s*['"](react|react-dom|next\/navigation|@commerce\/(ui|blocks|editor|richtext))(\/[^'"]*)?['"]/
const DIRECTIVE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use (client|server)\1/

type Exports = string | null | { [key: string]: Exports }

/** `./src/a/b.ts` → `./dist/a/b.js`; `.tsx` and other files keep their name. `types` stay on src. */
export function prebuiltExports(exports: Exports, condition?: string): Exports {
  if (typeof exports === 'string') {
    if (condition === 'types' || !exports.startsWith('./src/')) return exports
    return `./dist/${exports.slice('./src/'.length)}`.replace(/(?<!\.d)\.ts$/, '.js')
  }
  if (exports === null) return null
  return Object.fromEntries(
    Object.entries(exports).map(([k, v]) => [
      k,
      prebuiltExports(v, k.startsWith('.') ? undefined : k),
    ]),
  )
}

/** True when a package.json's exports already point into `dist/` (this script ran). */
export function pointsAtDist(exports: Exports): boolean {
  if (typeof exports === 'string') return exports.startsWith('./dist/')
  if (exports === null) return false
  return Object.values(exports).some(pointsAtDist)
}

/**
 * Gives each relative import in compiled JS its output file name. `resolve` maps a specifier
 * to its output specifier, or null when it points at nothing (then the script fails: a missed
 * import would only show up as a broken build later).
 */
export function rewriteSpecifiers(
  code: string,
  resolve: (specifier: string) => string | null,
): { code: string; unresolved: string[] } {
  const unresolved: string[] = []
  const out = code.replace(
    /(\bfrom\s*|\bimport\s*|\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?)(['"])(\.\.?\/[^'"\n]*)\2/g,
    (match, lead: string, quote: string, spec: string) => {
      const next = resolve(spec)
      if (next === null) {
        unresolved.push(spec)
        return match
      }
      return `${lead}${quote}${next}${quote}`
    },
  )
  return { code: out, unresolved }
}

/** Output specifier for `spec` imported from `fromDir` (a folder inside `srcDir`). */
function resolveFromSource(srcDir: string, fromDir: string, spec: string): string | null {
  const target = path.resolve(fromDir, spec)
  // Outside src/ (e.g. `../package.json`): dist/ sits at the same depth, so it still points there.
  if (path.relative(srcDir, target).startsWith('..')) return spec
  const isFile = (p: string) => existsSync(p) && statSync(p).isFile()
  if (/\.tsx?$/.test(spec) && isFile(target)) return spec.replace(/\.ts$/, '.js')
  if (/\.[a-z]+$/i.test(spec) && isFile(target)) return spec
  if (isFile(`${target}.ts`)) return `${spec}.js`
  if (isFile(`${target}.tsx`)) return `${spec}.tsx`
  if (isFile(path.join(target, 'index.ts'))) return `${spec.replace(/\/$/, '')}/index.js`
  if (isFile(path.join(target, 'index.tsx'))) return `${spec.replace(/\/$/, '')}/index.tsx`
  return null
}

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, out)
    else out.push(full)
  }
  return out
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  verbatimModuleSyntax: true,
  useDefineForClassFields: true,
  removeComments: false,
  sourceMap: false,
}

/** Hook call in the code itself, not in a comment (the kept output still has comments). */
function callsHook(source: string, fileName: string): boolean {
  const bare = ts.transpileModule(source, {
    fileName,
    compilerOptions: { ...COMPILER_OPTIONS, removeComments: true },
  }).outputText
  return HOOK_CALL.test(bare.replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""'))
}

/** Compiles one package's src/ to dist/. Returns problems (empty when it is fine). */
function compilePackage(pkgDir: string): { files: number; problems: string[] } {
  const srcDir = path.join(pkgDir, 'src')
  const distDir = path.join(pkgDir, 'dist')
  rmSync(distDir, { recursive: true, force: true })
  const problems: string[] = []
  let files = 0
  for (const file of listFiles(srcDir)) {
    const rel = path.relative(srcDir, file)
    if (TEST_FILE.test(rel)) continue
    const dest = path.join(distDir, rel)
    mkdirSync(path.dirname(dest), { recursive: true })
    files++
    const where = path.relative(ROOT, file).replaceAll('\\', '/')
    if (!file.endsWith('.ts')) {
      cpSync(file, dest)
      // A copied .tsx imports `./a` (resolves to the compiled a.js); `./a.ts` would not exist.
      if (file.endsWith('.tsx')) {
        const { unresolved } = rewriteSpecifiers(readFileSync(file, 'utf8'), (spec) =>
          spec.endsWith('.ts') ? null : spec,
        )
        for (const spec of unresolved) problems.push(`${where}: import '${spec}' without .ts`)
      }
      continue
    }
    const source = readFileSync(file, 'utf8')
    const { outputText } = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: COMPILER_OPTIONS,
    })
    const directive = DIRECTIVE.exec(source)?.[2]
    if (directive && !outputText.startsWith(`'use ${directive}'`)) {
      problems.push(`${where}: 'use ${directive}' did not stay at the top`)
    }
    if (
      HOOK_CALL.test(outputText) &&
      (directive === 'client' || REACT_IMPORT.test(outputText)) &&
      callsHook(source, file)
    ) {
      problems.push(
        `${where}: calls a React hook; a prebuilt .ts would skip the React Compiler. Move it to a .tsx or add the package to KEEP_SOURCE`,
      )
    }
    const { code, unresolved } = rewriteSpecifiers(outputText, (spec) =>
      resolveFromSource(srcDir, path.dirname(file), spec),
    )
    for (const spec of unresolved) problems.push(`${where}: cannot resolve import '${spec}'`)
    writeFileSync(dest.replace(/\.ts$/, '.js'), code)
  }
  return { files, problems }
}

function readPackage(
  pkgDir: string,
): { name: string; exports?: Exports } & Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
}

function writePackage(pkgDir: string, pkg: object) {
  writeFileSync(path.join(pkgDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
}

/** Packages to prebuild: every workspace package with a src/ and exports, minus KEEP_SOURCE. */
export function prebuildTargets(root = ROOT): string[] {
  const base = path.join(root, 'packages')
  return readdirSync(base)
    .map((dir) => path.join(base, dir))
    .filter(
      (dir) => existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, 'src')),
    )
    .filter((dir) => {
      const pkg = readPackage(dir)
      return pkg.exports !== undefined && !(pkg.name in KEEP_SOURCE)
    })
}

function revert() {
  for (const dir of prebuildTargets()) {
    const saved = path.join(dir, 'dist', MARKER)
    if (existsSync(saved)) {
      writePackage(dir, { ...readPackage(dir), exports: JSON.parse(readFileSync(saved, 'utf8')) })
    }
    rmSync(path.join(dir, 'dist'), { recursive: true, force: true })
  }
  console.log('prebuild: exports point at src/ again, dist/ removed')
}

/** Runs outside turbo (before `bun run build`), so the env comes straight from the Dockerfile. */
function main(env = process.env) {
  const args = process.argv.slice(2)
  if (args.includes('--revert')) return revert()
  if (env.BUILD_PREBUILT === '0') {
    console.log('prebuild: BUILD_PREBUILT=0, packages stay as source')
    return
  }
  const dry = args.includes('--dry')
  const started = performance.now()
  const problems: string[] = []
  const done: string[] = []
  let files = 0
  for (const dir of prebuildTargets()) {
    const pkg = readPackage(dir)
    if (pointsAtDist(pkg.exports ?? null)) {
      problems.push(`${pkg.name}: exports already point at dist/ (run with --revert first)`)
      continue
    }
    const result = compilePackage(dir)
    files += result.files
    problems.push(...result.problems)
    done.push(pkg.name)
    if (!dry) {
      writeFileSync(path.join(dir, 'dist', MARKER), `${JSON.stringify(pkg.exports, null, 2)}\n`)
      writePackage(dir, { ...pkg, exports: prebuiltExports(pkg.exports ?? null) })
    }
  }
  if (problems.length > 0) {
    console.error(`prebuild failed:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(
    `prebuild: ${done.length} packages, ${files} files in ${seconds}s${dry ? ' (dry: exports unchanged)' : ''}`,
  )
  console.log(`  prebuilt: ${done.join(', ')}`)
  console.log(`  source:   ${Object.keys(KEEP_SOURCE).join(', ')}`)
}

if (import.meta.main) main()
