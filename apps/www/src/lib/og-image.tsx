/**
 * The 1200×630 share card every page uses (WhatsApp, LinkedIn, X, Slack): the brand, the page's
 * title and one line under it, on the site's dark background. Built at request time by `next/og`
 * and cached by the CDN; styles are inline because the renderer reads no stylesheet.
 */
import { siteConfig } from '@commerce/config/site'
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export function ogImage({
  eyebrow,
  title,
  line,
}: {
  eyebrow?: string
  title: string
  line?: string
}) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: 'radial-gradient(circle at 80% 0%, #2a1f10 0%, #0a0a0a 55%)',
        color: '#fafafa',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#fafafa',
            color: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {siteConfig.brand.name.charAt(0)}
        </div>
        <div style={{ fontSize: 32, fontWeight: 600 }}>{siteConfig.brand.name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {eyebrow ? (
          <div
            style={{ fontSize: 26, color: '#f5a524', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ fontSize: title.length > 48 ? 60 : 72, fontWeight: 700, lineHeight: 1.08 }}>
          {title}
        </div>
        {line ? (
          <div style={{ fontSize: 30, color: '#a1a1aa', lineHeight: 1.35 }}>{line}</div>
        ) : null}
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#a1a1aa' }}
      >
        <span>{siteConfig.brand.domain}</span>
        <span>Built in India · UPI · GST · Hindi</span>
      </div>
    </div>,
    OG_SIZE,
  )
}
