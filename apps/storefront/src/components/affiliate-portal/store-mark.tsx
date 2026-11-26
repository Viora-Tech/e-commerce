type StoreMarkProps = {
  name: string
  logoUrl: string | null
  /** `sm` for the sign-in pages' small mark (login-03), `md` for the sidebar header. */
  size?: 'sm' | 'md'
}

/**
 * The store's square mark, as shadcn's blocks draw "Acme Inc.": its logo on a plain tile, or
 * its first letter on the primary colour when there is no logo.
 */
export default function StoreMark({ name, logoUrl, size = 'md' }: StoreMarkProps) {
  // Helpers
  const box = size === 'sm' ? 'size-6 rounded-md text-xs' : 'size-8 rounded-lg text-sm'

  // Early returns
  if (logoUrl)
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden border bg-background ${box}`}
      >
        {/* biome-ignore lint/performance/noImgElement: the store's logo from its CDN */}
        <img src={logoUrl} alt="" className="size-full object-contain p-0.5" />
      </span>
    )

  // Render logic
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground ${box}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
