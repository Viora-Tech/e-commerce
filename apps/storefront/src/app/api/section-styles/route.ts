import { sectionStylesFile } from '@/lib/section-styles'

/**
 * The section styles of our own themes (`lib/section-styles.ts`), the same for every store. The
 * page asks for `?v=<content hash>`: that answer is cached for a year; any other version (an old
 * page after a deploy) gets the current file, cached briefly.
 */
export function GET(request: Request): Response {
  const { css, current } = sectionStylesFile(new URL(request.url).searchParams.get('v'))
  return new Response(css, {
    headers: {
      'content-type': 'text/css; charset=utf-8',
      'cache-control': current
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60, s-maxage=60',
      'x-content-type-options': 'nosniff',
    },
  })
}
