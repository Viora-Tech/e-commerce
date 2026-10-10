type PanelIdentityProps = {
  /** "<Store> · <Template>" (Figma 369:4900). */
  title: string
  /** The store's web address, under the title. */
  domain: string
}

/**
 * The top of the editor's left panel in the Add and Layers views (Figma 369:4900 "Identity",
 * 369:121298): which store and page are being edited and the store's address, over a hairline.
 * The other panels open straight on their own head (`PanelTitle`), as their frames do.
 */
export default function PanelIdentity({ title, domain }: PanelIdentityProps) {
  // Render logic
  return (
    <header className="flex shrink-0 flex-col px-4 pt-4">
      <div className="flex flex-col gap-px border-b border-border pb-3">
        <h2 className="truncate font-sans text-sm leading-5 font-semibold tracking-normal normal-case text-foreground">
          {title}
        </h2>
        <p className="truncate text-xs leading-[1.0625rem] text-muted-foreground">{domain}</p>
      </div>
    </header>
  )
}
