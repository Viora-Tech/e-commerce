import { siteConfig } from '@commerce/config/site'
import { GUIDES, guidesContent } from '@/data/guides'

const site = siteConfig.urls.site

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const dynamic = 'force-static'

/** The guides as RSS 2.0, newest first, for feed readers and search engines. */
export function GET() {
  const items = [...GUIDES]
    .sort((a, b) => b.published.localeCompare(a.published))
    .map((g) => {
      const url = `${site}/guides/${g.slug}`
      return `<item><title>${escapeXml(g.title)}</title><link>${url}</link><guid>${url}</guid><description>${escapeXml(g.description)}</description><pubDate>${new Date(`${g.published}T00:00:00+05:30`).toUTCString()}</pubDate></item>`
    })
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(`${siteConfig.brand.name} ${guidesContent.eyebrow}`)}</title><link>${site}/guides</link><description>${escapeXml(guidesContent.metaDescription)}</description><language>en-IN</language>${items}</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
