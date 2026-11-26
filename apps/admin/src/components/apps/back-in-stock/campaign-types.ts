import type { api } from '@/lib/api-client'

/** The campaign form: the app's whole settings row, edited in place and saved together. */
export type CampaignForm = Awaited<ReturnType<typeof api.backInStock.settings.get>>

/** What every campaign tab gets: the form and a merge of changed fields. */
export type CampaignTabProps = {
  form: CampaignForm
  patch: (next: Partial<CampaignForm>) => void
}

/** The editor's tabs, in Essential's order. */
export const CAMPAIGN_TABS = ['notifications', 'button', 'popup', 'email', 'products'] as const
export type CampaignTab = (typeof CAMPAIGN_TABS)[number]

/** `?tab=` from a link (the Overview's "Manage"), or the first tab. */
export function tabFrom(value: string | null): CampaignTab {
  return (CAMPAIGN_TABS as readonly string[]).includes(value ?? '')
    ? (value as CampaignTab)
    : 'notifications'
}
