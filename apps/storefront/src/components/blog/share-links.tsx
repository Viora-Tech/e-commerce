import { blogContent as copy } from '@/data/blog'

type ShareLinksProps = { url: string; title: string }

function shareTargets(url: string, title: string) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return [
    { label: copy.share.x, short: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    {
      label: copy.share.facebook,
      short: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    { label: copy.share.whatsapp, short: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { label: copy.share.email, short: 'Email', href: `mailto:?subject=${t}&body=${u}` },
  ]
}

/** Plain share links; no third-party scripts load on the page. */
export default function ShareLinks({ url, title }: ShareLinksProps) {
  // Render logic
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-6 text-sm">
      <span className="text-muted">{copy.share.label}</span>
      {shareTargets(url, title).map((target) => (
        <a
          key={target.short}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={target.label}
          className="rounded-full border border-line px-3 py-1 text-ink hover:border-ink"
        >
          {target.short}
        </a>
      ))}
    </div>
  )
}
