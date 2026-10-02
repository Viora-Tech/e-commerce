import type { MissingDetail } from '@commerce/core'
import type { PolicyType } from '@commerce/core/policies'

/** Settings → Policies and its editor. */
export const policiesContent = {
  title: 'Policies',
  subtitle:
    'The pages Indian law expects every online shop to show. Shoppers find them in your footer and at checkout.',
  disclaimer: {
    title: 'Templates are a starting point, not legal advice.',
    body: 'They follow the Consumer Protection (E-Commerce) Rules 2020 and the DPDP Act 2023. Read each one, change what does not fit your shop, and ask a lawyer if you are unsure.',
  },
  list: {
    heading: 'Your policies',
    required: 'Needed',
    status: {
      published: 'Live',
      draft: 'Hidden',
      missing: 'Not created',
    },
    updated: (date: string) => `Last updated ${date}`,
    never: 'Not created yet',
    create: 'Create from template',
    edit: 'Edit',
    loadFailed: 'Could not load your policies.',
  },
  names: {
    'refund-policy': 'Refund and returns',
    'privacy-policy': 'Privacy',
    'terms-of-service': 'Terms of service',
    'shipping-policy': 'Shipping',
    'contact-information': 'Contact information',
  } satisfies Record<PolicyType, string>,
  hints: {
    'refund-policy': 'Uses your return window from Settings → Returns.',
    'privacy-policy': 'Written for the DPDP Act 2023. Names your grievance officer.',
    'terms-of-service': 'The rules for buying from your shop.',
    'shipping-policy': 'Uses delivery times from your shipping rates.',
    'contact-information': 'Your business details and grievance officer.',
  } satisfies Record<PolicyType, string>,
  business: {
    heading: 'Business details for your policies',
    help: 'Every policy prints these. Your store name, address, email and phone come from Settings → Store details, and your GSTIN from Settings → GST & invoices.',
    legalName: 'Registered business name',
    legalNameHint:
      'As on your GST or company papers, like "Waimers Tech Private Limited". Leave empty to use your store name.',
    generalLink: 'Edit store details',
  },
  grievance: {
    heading: 'Grievance officer',
    help: 'The person customers can complain to. The law asks you to name one. It can be you.',
    name: 'Name',
    designation: 'Role',
    designationPlaceholder: 'For example, Founder',
    email: 'Email',
    phone: 'Phone',
    shownIn: 'Shown in your privacy policy and your store footer.',
  },
  save: 'Save',
  saved: 'Saved.',
  failed: 'Could not save. Please try again.',
} as const

/** The editor for one policy. */
export const policyEditorContent = {
  back: 'Policies',
  title: 'Title',
  body: 'Policy text',
  bodyPlaceholder: 'Start from the template, or write your own.',
  visible: 'Show on your store',
  visibleHint: (path: string) => `Customers can open it at ${path}.`,
  hiddenHint: 'Hidden from customers until you turn this on.',
  fromTemplate: 'Create from template',
  refill: 'Start again from template',
  confirmTitle: 'Replace this text with the template?',
  confirmBody: 'Your changes to this policy will be replaced. You can still discard before saving.',
  confirm: 'Replace',
  cancel: 'Cancel',
  filled: 'Template added. Read it through, then save.',
  missingTitle: 'Some details are missing',
  missingBody:
    'The template shows these in [brackets]. Fill them in here, or add them and create it again:',
  missing: {
    address: { label: 'Business address', href: '/settings/store' },
    email: { label: 'Contact email', href: '/settings/store' },
    phone: { label: 'Contact phone', href: '/settings/store' },
    grievanceOfficerName: { label: 'Grievance officer name', href: '/settings/policies#grievance' },
    grievanceOfficerContact: {
      label: 'Grievance officer email or phone',
      href: '/settings/policies#grievance',
    },
  } satisfies Record<MissingDetail, { label: string; href: string }>,
  updated: (date: string) => `Last updated ${date}`,
  view: 'View on store',
  save: 'Save',
  saved: 'Policy saved.',
  failed: 'Could not save. Please try again.',
  empty: 'Add some text first, or create it from the template.',
  notFound: 'That policy does not exist.',
} as const
