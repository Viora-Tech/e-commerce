'use client'

import { validateGstin } from '@commerce/core/gstin'
import { CONSENT_CHANNELS, type ConsentChannel } from '@commerce/core/privacy'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ADMIN_APPS } from '@/apps/registry'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import SaveBar from '@/components/layout/save-bar'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ContactPhonePrompt from './contact-phone-prompt'
import CustomerActivityCard from './customer-activity-card'
import CustomerAddressesCard from './customer-addresses-card'
import CustomerBusinessCard from './customer-business-card'
import { type CustomerDetail, nextStepFor } from './customer-detail-types'
import CustomerHeader from './customer-header'
import CustomerNextStep from './customer-next-step'
import CustomerNoteCard from './customer-note-card'
import CustomerOrdersCard from './customer-orders-card'
import CustomerStatsCard from './customer-stats-card'
import CustomerTagsCard from './customer-tags-card'
import EditCustomerDialog from './edit-customer-dialog'
import MarketingConsentCard, { type ConsentWithChannels } from './marketing-consent-card'
import MessagesCard from './messages-card'
import ProfileCard from './profile-card'

type CustomerViewProps = {
  customer: CustomerDetail
  /** Installed apps with a card for this page (`admin.customerDetailCard`). */
  appCards?: string[]
  /** Open the edit dialog on arrival, so one click from elsewhere lands in it. */
  startEditing?: boolean
}

type Draft = {
  note: string
  tags: string[]
  gstin: string
  businessName: string
  consent: Record<ConsentChannel, boolean>
}

const draftOf = (customer: CustomerDetail, consent: ConsentWithChannels | null): Draft => ({
  note: customer.note ?? '',
  tags: customer.tags,
  gstin: customer.gstin ?? '',
  businessName: customer.businessName ?? '',
  consent: consent?.channels ?? { email: false, whatsapp: false, sms: false },
})

/** The `validateGstin` reason a typed GSTIN fails on; null when blank or valid. */
function gstinReason(value: string): 'shape' | 'state' | 'checksum' | null {
  if (value.trim() === '') return null
  const check = validateGstin(value)
  return check.ok ? null : ((check.reason as 'shape' | 'state' | 'checksum') ?? 'shape')
}

const sameTags = (a: string[], b: string[]) =>
  a.length === b.length && a.every((t, i) => t === b[i])

/**
 * The customer page. Note, tags, business details and marketing consent are edited in place
 * and saved together from one floating save bar; addresses and the profile keep their own
 * dialogs.
 */
export default function CustomerView({
  customer,
  appCards = [],
  startEditing = false,
}: CustomerViewProps) {
  // Hooks
  const router = useRouter()
  const detail = useCopy(customerDetailContent)
  const [editing, setEditing] = useState(startEditing)
  const [consent, setConsent] = useState<ConsentWithChannels | null>(null)
  // What is saved, and what the page shows; the bar is open while they differ.
  const [saved, setSaved] = useState<Draft>(() => draftOf(customer, null))
  const [draft, setDraft] = useState<Draft>(saved)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.customerPrivacy
      .consent({ customerId: customer.id })
      .then((c) => {
        setConsent(c)
        setSaved((d) => ({ ...d, consent: c.channels }))
        setDraft((d) => ({ ...d, consent: c.channels }))
      })
      .catch(() => setConsent(null))
  }, [customer.id])

  // Helpers
  const refresh = () => router.refresh()

  // Event handlers
  const handleSave = async () => {
    const refused = gstinReason(draft.gstin)
    if (refused) {
      toast.error(detail.gstinErrors[refused])
      return
    }
    setSaving(true)
    try {
      const note = draft.note.trim() || null
      const gstin = draft.gstin.trim().toUpperCase()
      const businessName = draft.businessName.trim()
      if (
        note !== (saved.note.trim() || null) ||
        !sameTags(draft.tags, saved.tags) ||
        gstin !== saved.gstin ||
        businessName !== saved.businessName
      ) {
        await api.customers.update({
          id: customer.id,
          note,
          tags: draft.tags,
          gstin: gstin || null,
          businessName: businessName || null,
        })
      }
      for (const channel of CONSENT_CHANNELS) {
        if (consent && draft.consent[channel] !== saved.consent[channel]) {
          await api.customerPrivacy.setConsent({
            customerId: customer.id,
            channel,
            granted: draft.consent[channel],
          })
        }
      }
      const fresh = await api.customerPrivacy.consent({ customerId: customer.id })
      setConsent(fresh)
      const next = {
        note: note ?? '',
        tags: draft.tags,
        gstin,
        businessName,
        consent: fresh.channels,
      }
      setSaved(next)
      setDraft(next)
      toast.success(detail.changes.saved)
      refresh()
    } catch {
      toast.error(detail.changes.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => setDraft(saved)

  // Render logic
  const step = nextStepFor(customer)
  const invalidGstin = gstinReason(draft.gstin)
  const dirty =
    draft.note.trim() !== saved.note.trim() ||
    !sameTags(draft.tags, saved.tags) ||
    draft.gstin.trim().toUpperCase() !== saved.gstin ||
    draft.businessName.trim() !== saved.businessName ||
    CONSENT_CHANNELS.some((c) => draft.consent[c] !== saved.consent[c])

  return (
    <PageBody width="frame" className="gap-6">
      <SaveBar
        open={dirty}
        message={detail.changes.unsaved}
        saveLabel={detail.changes.save}
        discardLabel={detail.changes.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <CustomerHeader
        customer={customer}
        onEdit={() => setEditing(true)}
        automations={appCards.includes('automations')}
      />
      {step ? <CustomerNextStep customer={customer} step={step} /> : null}
      <PageColumns
        main={
          <>
            <CustomerOrdersCard customer={customer} />
            <CustomerActivityCard customer={customer} />
            <MessagesCard messages={customer.notifications} />
            {appCards.map((id) => {
              const Card = ADMIN_APPS[id]?.CustomerCard
              return Card ? <Card key={id} customerId={customer.id} /> : null
            })}
          </>
        }
        side={
          <>
            <ProfileCard customer={customer} onEdit={() => setEditing(true)} onChanged={refresh} />
            <CustomerAddressesCard customer={customer} onChanged={refresh} />
            {consent ? (
              <MarketingConsentCard
                customerId={customer.id}
                customerLabel={customer.name || customer.email || customer.phone || ''}
                consent={consent}
                value={draft.consent}
                onChange={(channel, granted) =>
                  setDraft((d) => ({ ...d, consent: { ...d.consent, [channel]: granted } }))
                }
                hasPhone={Boolean(customer.phone)}
                phonePrompt={
                  <ContactPhonePrompt
                    customerId={customer.id}
                    suggestion={customer.phoneSuggestion}
                    onAdd={() => setEditing(true)}
                    onSaved={refresh}
                  />
                }
              />
            ) : null}
            <CustomerBusinessCard
              gstin={draft.gstin}
              businessName={draft.businessName}
              gstinError={invalidGstin ? detail.gstinErrors[invalidGstin] : null}
              onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
            />
            <CustomerNoteCard
              value={draft.note}
              onChange={(note) => setDraft((d) => ({ ...d, note }))}
            />
            <CustomerTagsCard
              tags={draft.tags}
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
            />
            <CustomerStatsCard customer={customer} />
            <MetafieldsCard ownerType="customer" ownerId={customer.id} hideWhenEmpty />
          </>
        }
      />
      {editing ? (
        <EditCustomerDialog
          customer={customer}
          open
          onClose={() => setEditing(false)}
          onSaved={refresh}
        />
      ) : null}
    </PageBody>
  )
}
