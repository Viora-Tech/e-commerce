import { siteConfig } from '@commerce/config/site'
import { acceptableUseDoc } from './acceptable-use'
import { cookiesDoc } from './cookies'
import { dataDeletionDoc } from './data-deletion'
import { privacyDoc } from './privacy'
import { refundsDoc } from './refunds'
import { shippingDoc } from './shipping'
import { termsDoc } from './terms'
import type { LegalDoc } from './types'

export const LEGAL_DOCS: readonly LegalDoc[] = [
  privacyDoc,
  termsDoc,
  cookiesDoc,
  refundsDoc,
  shippingDoc,
  acceptableUseDoc,
  dataDeletionDoc,
]

export const legalContent = {
  breadcrumbRoot: 'Legal',
  minRead: 'min read',
  english: 'English',
  hindi: 'हिन्दी',
  hindiSoon: 'The हिन्दी version is coming soon. This page is shown in English for now.',
  languageLabel: 'Language',
  downloadPdf: 'Download PDF',
  print: 'Print',
  templateNotice: 'TEMPLATE — review with a lawyer before publishing. Replace every [placeholder] and [OWNER: …].',
  onThisPage: 'On this page',
  read: 'read',
  backToTop: 'Back to top',
  plainWords: 'In plain words',
  questions: {
    title: 'Questions about this policy?',
    body: `Write to ${siteConfig.contact.supportEmail}.`,
    cta: 'Contact us',
  },
}
