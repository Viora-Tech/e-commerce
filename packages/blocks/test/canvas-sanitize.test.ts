import { describe, expect, it } from 'vitest'
import { sanitizeCanvasHtml } from '../src/canvas-sanitize'

/**
 * Security audit 2026-10-06 (A-05): imported theme markup on the Customize canvas, which is
 * an iframe on the admin's origin. The old regex missed unquoted handlers, `<script>` with
 * no end tag and every URL-based way to run script.
 */
describe('sanitizeCanvasHtml', () => {
  const runs = (html: string) => {
    const out = sanitizeCanvasHtml(html).toLowerCase()
    return /<script|\son\w+\s*=|javascript:|<iframe|<meta|<base|<object|<embed/.test(out)
  }

  it('removes every way markup can run script', () => {
    const payloads = [
      '<img src=x onerror=alert(1)>',
      '<img/onerror=alert(1) src=x>',
      '<div ONMOUSEOVER="alert(1)">x</div>',
      '<script>alert(1)',
      '<script src=//evil.example/x.js></script>',
      '<a href="javascript:alert(1)">x</a>',
      '<a href=" jav&#x09;ascript:alert(1)">x</a>',
      '<meta http-equiv="refresh" content="0;url=https://evil.example">',
      '<base href="https://evil.example/">',
      '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
      '<object data="javascript:alert(1)"></object><embed src="x.swf">',
      '<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>',
      '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
      '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">go</button></form>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    ]
    for (const payload of payloads) expect(runs(payload), payload).toBe(false)
  })

  it('never keeps text that a browser inside svg would read back as an element', () => {
    for (const payload of [
      '<svg><style><img src=x onerror=alert(1)></style></svg>',
      '<math><style>&lt;img src=x onerror=alert(1)&gt;</style></math>',
      '<svg><title>&lt;img src=x onerror=alert(1)&gt;</title></svg>',
    ]) {
      expect(sanitizeCanvasHtml(payload), payload).not.toMatch(/<img[^>]*onerror/i)
    }
  })

  it('keeps what a theme needs for its look', () => {
    const html =
      '<link rel="stylesheet" href="https://shop.example/theme-assets/t/base.css">' +
      '<style>.hero{color:red}</style>' +
      '<slider-component class="slider" data-autoplay="true" style="--gap: 1rem">' +
      '<svg aria-hidden="true"><use href="#icon-cart"></use></svg>' +
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">' +
      '<a href="/collections/all">Shop</a>' +
      '</slider-component>'
    const out = sanitizeCanvasHtml(html)
    for (const kept of [
      'rel="stylesheet"',
      '.hero{color:red}',
      '<slider-component',
      'data-autoplay="true"',
      'style="--gap: 1rem"',
      'href="#icon-cart"',
      'src="data:image/gif;base64,',
      'href="/collections/all"',
    ]) {
      expect(out).toContain(kept)
    }
  })

  it('keeps a stylesheet whose comment has a less-than sign', () => {
    const html =
      '<style>/* iOS < 16.4 */ .color-scheme-1 { --color-background: rgb(0 0 0); }</style>'
    expect(sanitizeCanvasHtml(html)).toContain('.color-scheme-1')
  })

  it('does not let a comment hide the end of a style element', () => {
    expect(runs('<style>/*</style><img src=x onerror=alert(1)>*/</style>')).toBe(false)
  })
})
