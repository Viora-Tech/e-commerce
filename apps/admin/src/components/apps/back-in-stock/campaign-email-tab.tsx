'use client'

import { Send as Mail, CircleCheck as MailCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import SwitchRow from '@/components/fields/switch-row'
import DataCard from '@/components/layout/data-card'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { CampaignTabProps } from './campaign-types'

/**
 * Campaign › Email: the two emails this app sends open in the store's email editor (one place
 * for the words, logo and look of every store email), and the double opt-in switch that
 * Essential calls "GDPR compliance".
 */
export default function CampaignEmailTab({ form, patch }: CampaignTabProps) {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)

  // Render logic
  const rows = [
    {
      id: 'back_in_stock_alert',
      icon: Mail,
      title: copy.alertEmail,
      help: copy.alertEmailHelp,
      shown: true,
    },
    {
      id: 'back_in_stock_confirm',
      icon: MailCheck,
      title: copy.confirmEmail,
      help: copy.confirmEmailHelp,
      shown: form.doubleOptIn,
    },
  ].filter((r) => r.shown)

  return (
    <>
      <DataCard title={copy.emailsCard} subtitle={copy.emailsHelp} flush>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-hairline border-t px-4 py-3">
            <r.icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium">{r.title}</p>
              <p className="text-caption text-muted-foreground">{r.help}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={routes.settings.notificationEdit(r.id)} />}
            >
              {copy.edit}
            </Button>
          </div>
        ))}
        <p className="border-hairline border-t px-4 py-3 text-caption text-muted-foreground">
          {copy.footerNote}
        </p>
      </DataCard>
      <DataCard title={copy.doubleOptInCard} bodyClassName="flex flex-col gap-4">
        <SwitchRow
          id="bis-double-opt-in"
          label={copy.doubleOptIn}
          description={copy.doubleOptInHelp}
          checked={form.doubleOptIn}
          onChange={(v) => patch({ doubleOptIn: v })}
        />
      </DataCard>
    </>
  )
}
