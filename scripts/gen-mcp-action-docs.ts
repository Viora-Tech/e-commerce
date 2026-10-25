/**
 * Writes `packages/api/src/mcp/action-docs.generated.ts`: the first sentence of each admin
 * procedure's JSDoc, keyed by its router path (`orders.fulfil`). The MCP `searchActions` tool
 * shows it as the action's description; JSDoc is gone at runtime, so it is collected here.
 *
 *   bun scripts/gen-mcp-action-docs.ts
 *
 * The `mcp-action-docs` sweep fails when the file is out of date with the routers.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROUTERS = path.join(ROOT, 'packages/api/src/routers')
export const ACTION_DOCS_FILE = path.join(ROOT, 'packages/api/src/mcp/action-docs.generated.ts')

/** Longest description kept: the search result is one line. */
const MAX_LENGTH = 200

type Parsed = {
  objects: Map<string, ts.ObjectLiteralExpression>
  /** Local name → the router file and the name it exports. */
  imports: Map<string, { file: string; name: string }>
}

function parse(file: string): Parsed {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(ROUTERS, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const objects = new Map<string, ts.ObjectLiteralExpression>()
  const imports = new Map<string, { file: string; name: string }>()
  for (const node of source.statements) {
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && ts.isObjectLiteralExpression(d.initializer))
          objects.set(d.name.text, d.initializer)
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const from = node.moduleSpecifier.text
      const bindings = node.importClause?.namedBindings
      if (!from.startsWith('./') || !bindings || !ts.isNamedImports(bindings)) continue
      for (const el of bindings.elements) {
        imports.set(el.name.text, {
          file: `${from.slice(2)}.ts`,
          name: (el.propertyName ?? el.name).text,
        })
      }
    }
  }
  return { objects, imports }
}

/** The JSDoc above a property, as one tidy sentence. */
function docOf(node: ts.Node): string | null {
  const text = node.getSourceFile().getFullText()
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []
  const jsdoc = ranges.filter((r) => text.slice(r.pos, r.pos + 3) === '/**').at(-1)
  if (!jsdoc) return null
  const body = text
    .slice(jsdoc.pos + 3, jsdoc.end - 2)
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/`/g, '')
    .trim()
  if (!body) return null
  const sentence = body.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? body
  return sentence.length > MAX_LENGTH ? `${sentence.slice(0, MAX_LENGTH - 1).trimEnd()}…` : sentence
}

/** Every router path under `appRouter` with its JSDoc sentence. */
export function collectActionDocs(): Record<string, string> {
  const files = new Map<string, Parsed>()
  const parsed = (file: string) => {
    let p = files.get(file)
    if (!p) {
      p = parse(file)
      files.set(file, p)
    }
    return p
  }
  for (const f of readdirSync(ROUTERS)) if (f.endsWith('.ts')) parsed(f)

  const out: Record<string, string> = {}
  const resolve = (file: string, name: string): [string, ts.ObjectLiteralExpression] | null => {
    const p = parsed(file)
    const own = p.objects.get(name)
    if (own) return [file, own]
    const imported = p.imports.get(name)
    return imported ? resolve(imported.file, imported.name) : null
  }
  const walk = (file: string, obj: ts.ObjectLiteralExpression, prefix: string[]) => {
    for (const prop of obj.properties) {
      // `...orderListRoutes`: routes kept in their own module, mounted flat on this router.
      if (ts.isSpreadAssignment(prop) && ts.isIdentifier(prop.expression)) {
        const target = resolve(file, prop.expression.text)
        if (target) walk(target[0], target[1], prefix)
        continue
      }
      if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) continue
      const key = prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
      if (!key) continue
      const name = (prop.name as ts.Identifier | ts.StringLiteral).text
      const at = [...prefix, name]
      const value = ts.isPropertyAssignment(prop) ? prop.initializer : prop.name
      if (ts.isObjectLiteralExpression(value)) {
        walk(file, value, at)
        continue
      }
      if (ts.isIdentifier(value)) {
        const target = resolve(file, value.text)
        if (target) {
          walk(target[0], target[1], at)
          continue
        }
      }
      const doc = docOf(prop)
      if (doc) out[at.join('.')] = doc
    }
  }
  const app = resolve('_app.ts', 'appRouter')
  if (!app) throw new Error('appRouter not found in packages/api/src/routers/_app.ts')
  walk(app[0], app[1], [])
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

function render(docs: Record<string, string>): string {
  const rows = Object.entries(docs).map(
    ([key, doc]) => `  ${JSON.stringify(key)}: ${JSON.stringify(doc)},`,
  )
  return [
    '// Generated by `bun scripts/gen-mcp-action-docs.ts` from the routers’ JSDoc. Do not edit.',
    '',
    '/** Admin procedure path → the first sentence of its JSDoc (MCP `searchActions`). */',
    'export const ACTION_DOCS: Record<string, string> = {',
    ...rows,
    '}',
    '',
  ].join('\n')
}

if (import.meta.main) {
  writeFileSync(ACTION_DOCS_FILE, render(collectActionDocs()))
  spawnSync('bunx', ['biome', 'format', '--write', ACTION_DOCS_FILE], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}
