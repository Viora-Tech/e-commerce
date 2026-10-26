import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHAT_GUARD } from './inbox-guard'

const DIR = join(__dirname, '..', 'components', 'inbox')
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ name: f, source: readFileSync(join(DIR, f), 'utf8') }))

/** Typography and margin utilities a theme's unlayered CSS would otherwise beat. */
const TYPOGRAPHY =
  /(?<=[\s'"`])(?:[a-z0-9-]+:)*(?:text-\[(?:\d|calc)[^\]\s]*\]|font-(?:normal|medium|semibold|bold|mono)|leading-[a-z0-9[\].-]+|tracking-[a-z0-9[\].()-]+|m[trblxy]?-[a-z0-9[\].-]+)(?=[\s'"`])/g

describe('Inbox widget: theme CSS cannot restyle it', () => {
  it('both roots carry the guard', () => {
    for (const name of ['chat-widget.tsx', 'inbox-launcher.tsx']) {
      expect(files.find((f) => f.name === name)?.source).toMatch(/className=\{`\$\{CHAT_GUARD\} /)
    }
    expect(CHAT_GUARD).toContain('normal-case!')
    expect(CHAT_GUARD).toContain('[letter-spacing:normal]!')
  })

  it('every typography and margin utility is important (`!`)', () => {
    const bare = files.flatMap(({ name, source }) =>
      [...source.matchAll(TYPOGRAPHY)].map((m) => `${name}: ${m[0]}`),
    )
    expect(bare).toEqual([])
  })

  it('every heading sets its own size and weight with `!`', () => {
    const headings = files.flatMap(({ name, source }) =>
      [...source.matchAll(/<h[1-6]\b[^>]*>/g)].map((m) => ({ name, tag: m[0] })),
    )
    expect(headings.length).toBeGreaterThan(0)
    for (const { name, tag } of headings) {
      expect(tag, name).toMatch(/text-\[[^\]]+\]!/)
      expect(tag, name).toMatch(/font-(?:normal|medium|semibold|bold)!/)
    }
  })
})
