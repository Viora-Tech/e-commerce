/** Copy for `/policies/<type>` and the policy links in the footer and at checkout. */
const updated = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' })

export const policyPageContent = {
  updated: (at: Date) => `Last updated ${updated.format(at)}`,
  footerLabel: 'Store policies',
  grievance: (g: { name: string; email: string; phone: string }) =>
    `Grievance officer: ${[g.name, g.email, g.phone].filter(Boolean).join(', ')}`,
} as const
