'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { mermaidConfig } from '../lib/mermaid-config'

type MermaidProps = {
  chart: string
}

function decode(chart: string): string {
  return chart.replaceAll('\\n', '\n')
}

function isDarkPage(): boolean {
  const html = document.documentElement
  return html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark'
}

/**
 * Renders a ```mermaid block. Replaces @theguild/remark-mermaid's own component (Nextra's
 * remark plugin still turns the code block into `<Mermaid chart="…" />`; next.config.mjs
 * aliases its import here) so every diagram gets our hand-drawn theme from
 * lib/mermaid-config.ts. Renders once scrolled near, and again when the page theme flips.
 */
export default function Mermaid({ chart }: MermaidProps) {
  const id = useId().replaceAll(':', '')
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect()
          setVisible(true)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const source = decode(chart)

    const render = async () => {
      const { default: mermaid } = await import('mermaid')
      try {
        mermaid.initialize(mermaidConfig(isDarkPage(), getComputedStyle(document.body).fontFamily))
        const { svg } = await mermaid.render(`mermaid-${id}`, source)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setFailed(false)
        }
      } catch (error) {
        console.error('Error while rendering mermaid', error)
        if (!cancelled) setFailed(true)
      }
    }

    const observer = new MutationObserver(() => {
      render()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    render()
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [chart, id, visible])

  return (
    <figure
      data-pagefind-ignore="all"
      className="not-prose mt-6 overflow-x-auto rounded-xl border border-(--docs-border) bg-(--docs-surface) px-4 py-6"
    >
      <div
        ref={containerRef}
        className="flex min-h-40 justify-center [&_foreignObject_p]:m-0! [&_foreignObject_p]:leading-normal! [&>svg]:h-auto [&>svg]:max-w-full"
      />
      {failed && (
        <pre className="text-xs whitespace-pre-wrap text-(--docs-muted)">{decode(chart)}</pre>
      )}
    </figure>
  )
}
