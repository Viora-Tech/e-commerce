import { siteConfig, whatsappHelpUrl } from '@commerce/config/site'

/* The support contacts from siteConfig (the one source of truth), as two cards. */
export default function ContactLinks() {
  const cards = [
    {
      href: whatsappHelpUrl(),
      title: 'WhatsApp',
      detail: 'Fastest. Type your question; we reply in plain words.',
    },
    {
      href: `mailto:${siteConfig.contact.supportEmail}`,
      title: 'Email',
      detail: siteConfig.contact.supportEmail,
    },
  ]

  return (
    <div className="not-prose my-6 grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <a
          key={card.title}
          href={card.href}
          className="docs-card flex flex-col gap-1 p-4 no-underline"
        >
          <span className="font-medium" style={{ color: 'var(--docs-fg)' }}>
            {card.title}
          </span>
          <span className="text-sm" style={{ color: 'var(--docs-muted)' }}>
            {card.detail}
          </span>
        </a>
      ))}
    </div>
  )
}
