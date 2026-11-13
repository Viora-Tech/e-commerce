type ShoppersPreviewCardProps = {
  title: string
  /** Under the title, for screen readers and hover: what the bubbles are. */
  help: string
  /** The message texts, sample details filled in. */
  messages: string[]
}

/**
 * "What shoppers get" (Figma 928:12086): the store's order confirmed and shipped templates,
 * as chat bubbles with sample details in place of the placeholders.
 */
export default function ShoppersPreviewCard({ title, help, messages }: ShoppersPreviewCardProps) {
  return (
    <section
      className="flex flex-col rounded-xl border border-panel-border bg-card pb-4"
      aria-describedby="whatsapp-preview-help"
    >
      <h3 className="px-4 pt-3.5 pb-2.5 text-body font-semibold text-ink-strong">{title}</h3>
      <p id="whatsapp-preview-help" className="sr-only">
        {help}
      </p>
      <ul className="flex flex-col gap-2 px-4">
        {messages.map((text) => (
          <li
            key={text}
            className="rounded-lg bg-muted px-3 py-2.5 text-caption leading-[0.9375rem] break-words text-foreground"
          >
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}
