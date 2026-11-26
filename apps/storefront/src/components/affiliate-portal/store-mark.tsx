type StoreMarkProps = {
  name: string
  /** The store's square icon (its favicon); a wide logo would shrink to a speck in the tile. */
  iconUrl: string | null
  /** `sm` for the sign-in pages' small mark (login-03), `md` for the sidebar header. */
  size?: 'sm' | 'md'
}

/**
 * The store's square mark, as shadcn's blocks draw "Acme Inc.": its icon on a plain tile, or
 * its first letter on the primary (brand) colour when it has no icon.
 */
export default function StoreMark({ name, iconUrl, size = 'md' }: StoreMarkProps) {
  // Helpers
  const box = size === 'sm' ? 'size-6 rounded-md text-xs' : 'size-8 rounded-lg text-sm'

  // Early returns
  if (iconUrl)
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden border bg-background ${box}`}
      >
        {/* biome-ignore lint/performance/noImgElement: the store's logo from its CDN */}
        <img src={iconUrl} alt="" className="size-full object-cover" />
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
