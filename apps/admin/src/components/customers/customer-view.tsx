'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import CustomerActivityCard from './customer-activity-card'
import CustomerAddressesCard from './customer-addresses-card'
import { type CustomerDetail, nextStepFor } from './customer-detail-types'
import CustomerHeader from './customer-header'
import CustomerNextStep from './customer-next-step'
import CustomerNoteCard from './customer-note-card'
import CustomerOrdersCard from './customer-orders-card'
import CustomerStatsCard from './customer-stats-card'
import CustomerTagsCard from './customer-tags-card'
import EditCustomerDialog from './edit-customer-dialog'
import MarketingConsentCard from './marketing-consent-card'
import MessagesCard from './messages-card'
import ProfileCard from './profile-card'

type CustomerViewProps = {
  customer: CustomerDetail
  /** Open the edit dialog on arrival, so one click from elsewhere lands in it. */
  startEditing?: boolean
}

export default function CustomerView({ customer, startEditing = false }: CustomerViewProps) {
  // Hooks
  const router = useRouter()
  const [editing, setEditing] = useState(startEditing)

  // Helpers
  const refresh = () => router.refresh()

  // Render logic
  const step = nextStepFor(customer)

  return (
    <PageBody width="frame" className="max-w-[77.5rem] gap-6 md:mx-auto">
      <CustomerHeader customer={customer} onEdit={() => setEditing(true)} />
      {step ? <CustomerNextStep customer={customer} step={step} /> : null}
      <PageColumns
        main={
          <>
            <CustomerOrdersCard customer={customer} />
            <CustomerActivityCard customer={customer} />
            <MessagesCard messages={customer.notifications} />
          </>
        }
        side={
          <>
            <ProfileCard customer={customer} onEdit={() => setEditing(true)} />
            <CustomerAddressesCard customer={customer} onChanged={refresh} />
            <MarketingConsentCard
              customerId={customer.id}
              customerLabel={customer.name || customer.email || customer.phone || ''}
              onChanged={refresh}
            />
            <CustomerNoteCard customerId={customer.id} note={customer.note} onChanged={refresh} />
            <CustomerTagsCard customerId={customer.id} tags={customer.tags} onChanged={refresh} />
            <CustomerStatsCard customer={customer} />
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
