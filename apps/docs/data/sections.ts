export const sections = [
  { id: 'merchant', label: 'Merchant guide', href: '/merchant-guide/start-here/welcome' },
  { id: 'developer', label: 'Developers', href: '/developer-docs/getting-started/architecture' },
] as const

export type SectionId = (typeof sections)[number]['id']

export const feedbackCopy = {
  question: 'Was this helpful?',
  yes: 'Yes, this page was helpful',
  no: 'No, this page was not helpful',
  thanks: 'Thanks for the feedback!',
}
