import { SOLUTIONS, solutionBySlug } from '@/data/solutions'
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og-image'

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export const alt = 'Koomerce for Indian online stores'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const solution = solutionBySlug(slug)
  return ogImage({
    eyebrow: solution?.eyebrow,
    title: solution?.title ?? 'Koomerce',
    line: solution?.lead,
  })
}
