import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RichCopy from '../src/components/rich-copy'
import { createBlocksConfig } from '../src/puck-config'
import { richtextHtml } from '../src/richtext-html'
import { isBlankRichtext, mainProductRichtext, richtextNode } from '../src/richtext-node'
import { mainProductSettings } from '../src/sections/main-product-settings'
import { richtextProps } from '../src/sections/richtext-props'

/**
 * Body copy is sanitised on the server (`richtextNode`) and client sections draw the result, so
 * the browser never loads sanitize-html. What gets through must not change: the same allow-list,
 * the same markup RichCopy drew when it sanitised in the component.
 */

const LEXICAL = JSON.stringify({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Old <copy>', format: 1 }],
      },
    ],
  },
})

const INPUTS: unknown[] = [
  'Free shipping over Rs 999 & more',
  'One\nline two\n\nSecond para',
  '<p><strong>Bold</strong> <em>it</em> <u>under</u></p><ul><li>One</li></ul>',
  '<p onclick="x()" style="color:red">Hi<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>',
  '<p><img src="https://cdn.test/a.jpg" alt="A" width="40" title="t" style="x"><img src="/media/b.jpg" alt=""></p>',
  '<p>x<img src="data:image/png;base64,AAAA"><img src="//evil.test/a.jpg"><img src="b.jpg"><img></p>',
  '<p><a href="https://x.test" target="_blank">x</a><a href="vbscript:x">y</a></p>',
  '<svg><script>alert(1)</script></svg><iframe src="https://evil.test"></iframe><style>*{}</style>',
  '<h2>Head</h2><blockquote>q</blockquote><hr><table><tr><td>cell</td></tr></table>',
  '<script>alert(1)</script>',
  LEXICAL,
  JSON.parse(LEXICAL),
]

/** What RichCopy drew before the sanitiser moved to the server. */
const drawnBefore = (value: unknown, className: string) => {
  const html = richtextHtml(value)
  return html ? `<div class="${className}">${html}</div>` : ''
}

const draw = (value: unknown, className = 'rte') =>
  renderToStaticMarkup(createElement(RichCopy, { value: value as ReactNode, className }))

describe('server-sanitised body copy', () => {
  it('draws exactly what RichCopy drew before, for every kind of stored copy', () => {
    for (const value of INPUTS) {
      expect(draw(richtextNode(value)), String(value)).toBe(drawnBefore(value, 'rte'))
      expect(draw(value), String(value)).toBe(drawnBefore(value, 'rte'))
    }
  })

  it('lets nothing executable through', () => {
    for (const value of INPUTS) {
      const html = draw(richtextNode(value))
      expect(html).not.toMatch(/<script|<iframe|<style|<svg|onerror|onclick|javascript:|vbscript:/i)
    }
  })

  it('draws the class through RichCopyScope when the element reaches it unresolved', () => {
    const element = richtextNode('<p>Hi</p>')
    // What a client section receives from the server: a lazy reference React resolves on draw.
    const lazy = { $$typeof: Symbol.for('react.lazy'), _payload: element, _init: (e: unknown) => e }
    expect(draw(lazy, 'faq__answer')).toBe('<div class="faq__answer"><p>Hi</p></div>')
  })

  it('leaves blank copy and editor nodes as they are', () => {
    expect(richtextNode('')).toBe('')
    expect(richtextNode('   ')).toBe('   ')
    const node = createElement('span', null, 'inline editor')
    expect(richtextNode(node)).toBe(node)
    expect(richtextNode(undefined)).toBeUndefined()
  })

  it('a stored object that looks like sanitised copy is not trusted', () => {
    // Saved data is JSON: it can hold an object, never a React element.
    const forged = { html: '<img src=x onerror=alert(1)>', sanitised: true }
    expect(richtextNode(forged)).toBe(forged)
    expect(() => draw(forged)).toThrow(/Objects are not valid as a React child/)
  })

  it('isBlankRichtext reads sanitised and stored copy alike', () => {
    expect(isBlankRichtext(richtextNode('<script>x</script>'))).toBe(true)
    expect(isBlankRichtext('<script>x</script>')).toBe(true)
    expect(isBlankRichtext(richtextNode('<p>x</p>'))).toBe(false)
    expect(isBlankRichtext('')).toBe(true)
  })
})

describe('richtextProps (every framed section)', () => {
  const fields = {
    intro: { type: 'richtext' },
    heading: { type: 'text' },
    items: {
      type: 'array',
      arrayFields: { question: { type: 'text' }, answer: { type: 'richtext' } },
    },
    box: { type: 'object', objectFields: { body: { type: 'richtext' } } },
  }

  it('sanitises richtext fields at every depth and leaves the rest', () => {
    const props = richtextProps(
      {
        heading: '<b>plain text field</b>',
        intro: '<p>Hi<script>x</script></p>',
        items: [{ question: 'Q?', answer: '<img src=x onerror=alert(1)>A' }],
        box: { body: 'Plain' },
        extra: 1,
      },
      fields,
    )
    expect(props.heading).toBe('<b>plain text field</b>')
    expect(props.extra).toBe(1)
    expect(draw(props.intro)).toBe('<div class="rte"><p>Hi</p></div>')
    expect(draw(props.items[0]?.answer)).toBe('<div class="rte">A</div>')
    expect(draw(props.box.body)).toBe('<div class="rte"><p>Plain</p></div>')
  })

  it('a client section (FAQ accordion) draws the sanitised intro (answers mount when opened)', () => {
    const config = createBlocksConfig(async () => [])
    const faq = config.components.FaqAccordion
    if (!faq) throw new Error('FaqAccordion is not registered')
    const props = {
      ...(faq.defaultProps as Record<string, unknown>),
      intro: '<p>Read <a href="javascript:x">this</a><script>alert(1)</script></p>',
      items: [{ question: 'Ship?', answer: '<p>Yes<img src=x onerror=alert(1)></p>' }],
    }
    const html = renderToStaticMarkup(
      // @ts-expect-error -- loose test props against the config's widened component type
      faq.render({ ...props, puck: { metadata: {} } }),
    )
    expect(html).toContain('<div class="faq-accordion__intro"><p>Read <a>this</a></p></div>')
    expect(html).not.toMatch(/<script|onerror|javascript:/)
  })
})

describe('mainProductRichtext (the product page buy box)', () => {
  it('sanitises the offer panel and accordion bodies, as RichCopy did', () => {
    const settings = mainProductRichtext(
      mainProductSettings({
        offerBody: '<p>Pay by UPI<script>x</script></p>',
        accordions: [{ title: 'Care', body: '<p>Wipe<img src=x onerror=1></p>' }],
      }),
    )
    expect(draw(settings.offerBody)).toBe('<div class="rte"><p>Pay by UPI</p></div>')
    expect(draw(settings.accordions[0]?.body)).toBe('<div class="rte"><p>Wipe</p></div>')
  })
})

/**
 * No client module in this package reaches the sanitiser through its imports, so the storefront's
 * browser bundle never contains sanitize-html (measured: about 64 kB gzip off every store page).
 */
describe('client modules never import the sanitiser', () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(name)) files.push(path)
    }
  }
  walk(src)
  const resolveImport = (from: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null
    const base = resolve(dirname(from), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const path = base + ext
      if (files.includes(path)) return path
    }
    return null
  }
  const IMPORT = /(?:import|export)\s+(?!type\b)(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g
  const importsOf = (file: string) =>
    [...readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1] as string)

  it('from any "use client" module', () => {
    const reaching: string[] = []
    for (const file of files) {
      if (!/^\s*['"]use client['"]/.test(readFileSync(file, 'utf8'))) continue
      const seen = new Set([file])
      const queue = [file]
      while (queue.length) {
        const current = queue.shift() as string
        for (const spec of importsOf(current)) {
          if (spec === 'sanitize-html') reaching.push(`${file} -> ${current}`)
          const next = resolveImport(current, spec)
          if (next && !seen.has(next)) {
            seen.add(next)
            queue.push(next)
          }
        }
      }
    }
    expect(reaching).toEqual([])
  })
})
