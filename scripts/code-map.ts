/**
 * Code map: what each file is for, without opening it. Built for agents (and people) starting
 * a task: one command instead of a dozen searches. Always current, because it reads the files
 * each time; nothing is generated or committed.
 *
 *   bun run code-map                         every app and package, with its file count
 *   bun run code-map packages/core/src/seo   each file under that folder: purpose + exports
 *   bun run code-map shipping checkout       folders whose path contains these words
 *
 * The purpose is the file's `SOURCE OF TRUTH:` header when it has one, else the first
 * sentence of its first doc comment (top of file or above the main export).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dir, '..')
const WORKSPACES = ['apps', 'packages']
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', '__generated__', '.git'])
const SOURCE = /\.(ts|tsx)$/
const SKIP_FILE = /\.(test|spec|d)\.tsx?$/
const MAX_PURPOSE = 160
const MAX_EXPORTS = 8

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SOURCE.test(name) && !SKIP_FILE.test(name)) out.push(full)
  }
  return out
}

const rel = (full: string) => path.relative(ROOT, full).split(path.sep).join('/')

/** The file's purpose in one line. */
function purpose(source: string): string {
  const sot = /SOURCE OF TRUTH:\s*([\s\S]*?)\*\//.exec(source)
  if (sot?.[1]) {
    const text = sot[1].replace(/\s+/g, ' ').trim()
    const what = /WHAT:?\s*(.*?)(?:\/\s*WHY|$)/.exec(text)?.[1] ?? text
    const keywords = text.split(/\s+—\s+/)[0] ?? ''
    return clip(keywords && what !== text ? `${keywords}: ${what}` : text)
  }
  const doc = /\/\*\*([\s\S]*?)\*\//.exec(source)?.[1]
  if (!doc) return ''
  const text = doc
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .filter((l) => !l.startsWith('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = /^(.*?[.!?])(\s|$)/.exec(text)?.[1] ?? text
  return clip(sentence)
}

function clip(text: string): string {
  return text.length > MAX_PURPOSE ? `${text.slice(0, MAX_PURPOSE - 1)}…` : text
}

/** Exported names, the default export first. */
function exportsOf(source: string): string[] {
  const names: string[] = []
  const def = /export default (?:async )?function\s+(\w+)/.exec(source)?.[1]
  if (def) names.push(`${def} (default)`)
  const re = /^export (?:async )?(?:function\*?|const|let|class|type|enum)\s+(\w+)/gm
  for (const m of source.matchAll(re)) if (m[1] && !names.includes(m[1])) names.push(m[1])
  if (/^export \* from/m.test(source)) names.push('re-exports')
  return names
}

function describeFile(full: string): string {
  const source = readFileSync(full, 'utf8')
  const what = purpose(source)
  const names = exportsOf(source)
  const shown = names.slice(0, MAX_EXPORTS).join(', ')
  const more = names.length > MAX_EXPORTS ? ` +${names.length - MAX_EXPORTS}` : ''
  const exports = names.length ? `  [${shown}${more}]` : ''
  return `${rel(full)}${what ? ` — ${what}` : ''}${exports}`
}

/** One line per app and package: name, description and how many source files it has. */
function overview(): string[] {
  const lines: string[] = []
  for (const ws of WORKSPACES) {
    for (const name of readdirSync(path.join(ROOT, ws)).sort()) {
      const dir = path.join(ROOT, ws, name)
      if (!statSync(dir).isDirectory()) continue
      let description = ''
      try {
        const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
        description = pkg.description ?? ''
      } catch {}
      const files = walk(dir).length
      lines.push(`${ws}/${name} (${files} files)${description ? ` — ${description}` : ''}`)
    }
  }
  return lines
}

function main(args: string[]) {
  if (args.length === 0) {
    console.log(overview().join('\n'))
    console.log(
      '\nNext: bun run code-map <folder or words>, e.g. bun run code-map packages/core/src/seo',
    )
    return
  }
  const all = WORKSPACES.flatMap((ws) => walk(path.join(ROOT, ws)))
  const wanted = args.map((a) => a.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase())
  const matches = all.filter((f) => {
    const r = rel(f).toLowerCase()
    return wanted.every((w) => r.includes(w))
  })
  if (matches.length === 0) {
    console.log(`No source files match: ${args.join(' ')}`)
    return
  }
  let lastDir = ''
  const byFolder = (a: string, b: string) =>
    path.dirname(a).localeCompare(path.dirname(b)) || a.localeCompare(b)
  for (const f of matches.sort(byFolder)) {
    const dir = path.dirname(rel(f))
    if (dir !== lastDir) {
      console.log(`\n${dir}/`)
      lastDir = dir
    }
    console.log(`  ${describeFile(f).slice(dir.length + 1)}`)
  }
  console.log(`\n${matches.length} files`)
}

main(process.argv.slice(2))
