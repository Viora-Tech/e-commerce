type PanelIdentityProps = {
  /** "<Store> · <Template>" (Figma 369:4900). */
  title: string
  /** The store's web address, under the title. */
  domain: string
  /** The open panel's own name and one line, for every panel but Add, which shows its switch. */
  panel: { title: string; hint: string } | null
}

/**
 * The top of the editor's left panel (Figma 369:4900 "Identity"): which store and page are being
 * edited and the store's address, over a hairline; then the open panel's name.
 */
export default function PanelIdentity({ title, domain, panel }: PanelIdentityProps) {
  // Render logic
  return (
    <header className="flex shrink-0 flex-col px-4 pt-4">
      <div className="flex flex-col gap-px border-b border-border pb-3">
        <h2 className="truncate text-sm leading-5 font-semibold text-foreground">{title}</h2>
        <p className="truncate text-xs leading-[1.0625rem] text-muted-foreground">{domain}</p>
      </div>
      {panel ? (
        <div className="flex flex-col gap-px pt-4 pb-2">
          <p className="truncate text-sm leading-5 font-semibold text-foreground">{panel.title}</p>
          <p className="truncate text-xs leading-[1.0625rem] text-muted-foreground">{panel.hint}</p>
        </div>
      ) : null}
    </header>
  )
}
