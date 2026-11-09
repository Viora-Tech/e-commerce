/**
 * SPIKE shim for `next/link`: a plain anchor that navigates client-side through TanStack
 * Router (`navigate({ href })`, so `?query=` strings work unchanged) and preloads on hover
 * like Next's prefetch. Only string hrefs, which is all the admin passes.
 */
import { useRouter } from '@tanstack/react-router'
import { type AnchorHTMLAttributes, forwardRef, type MouseEvent } from 'react'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname?: string; query?: Record<string, string> }
  prefetch?: boolean | null
  replace?: boolean
  scroll?: boolean
}

function toHref(href: Props['href']): string {
  if (typeof href === 'string') return href
  const qs = href.query ? `?${new URLSearchParams(href.query)}` : ''
  return `${href.pathname ?? ''}${qs}`
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, prefetch: _prefetch, replace, scroll: _scroll, onClick, onMouseEnter, target, ...rest },
  ref,
) {
  const router = useRouter()
  const url = toHref(href)
  const internal = url.startsWith('/') && !url.startsWith('//')
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || !internal || target === '_blank') return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    void router.navigate({ href: url, replace: replace ?? false })
  }
  const handleEnter = (e: MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(e)
    if (internal) void router.preloadRoute({ href: url } as never).catch(() => undefined)
  }
  return (
    <a
      ref={ref}
      href={url}
      target={target}
      onClick={handleClick}
      onMouseEnter={handleEnter}
      {...rest}
    />
  )
})

export default Link
