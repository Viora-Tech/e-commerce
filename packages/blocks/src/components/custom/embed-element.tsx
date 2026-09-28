import { customSectionsContent as copy } from '../../data/custom-sections'
import { sanitizeEmbedHtml } from '../../embed-sanitize'
import ElementBox from './element-box'

export type CustomHtmlProps = {
  html: string
  title: string
  editing?: boolean | undefined
  style: unknown
}

/**
 * Merchant HTML or an embed, always through the allow-list
 * (`sanitizeEmbedHtml`): here on every render, and again when a template is
 * saved. Allowed iframes are made responsive at 16:9.
 */
export default function EmbedElement({ html, title, editing, style }: CustomHtmlProps) {
  // Render logic
  const clean = sanitizeEmbedHtml(html)
  if (!clean) {
    return editing ? (
      <ElementBox look={style} className="custom-embed">
        <p className="m-0 rounded border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
          {copy.empty.html}
        </p>
      </ElementBox>
    ) : null
  }
  return (
    <ElementBox
      look={style}
      className="custom-embed rte [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:border-0 [&_img]:h-auto [&_img]:max-w-full"
    >
      <div
        title={title || undefined}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by sanitizeEmbedHtml's allow-list above.
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </ElementBox>
  )
}
