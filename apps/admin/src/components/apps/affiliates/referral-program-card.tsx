'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type ReferralProgramCardProps = {
  programs: { id: string; name: string; isDefault: boolean }[]
}

/**
 * Programs › Referral program: our Share and earn (buyers invited to become affiliates after an
 * order), whether it is on and which program they join, with a way to its settings.
 */
export default function ReferralProgramCard({ programs }: ReferralProgramCardProps) {
  // Hooks
  const { programs: copy } = useCopy(affiliatesLayoutContent)
  const { data: settings } = useLoad(() => api.affiliates.settings.get())

  // Early returns
  if (!settings) return <DataCardSkeleton fields={0} lines={2} />

  // Render logic
  const r = copy.referral
  const on = settings.autoEnrol.mode === 'invite'
  const joins =
    programs.find((p) => p.id === settings.autoEnrol.programId) ?? programs.find((p) => p.isDefault)

  return (
    <SettingsCard
      title={r.title}
      description={r.body}
      footer={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.apps.page('affiliates', 'settings')} />}
        >
          {r.open}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip tone={on ? 'success' : 'neutral'}>{on ? r.on : r.off}</StatusChip>
        {joins ? <span className="text-body">{r.program(joins.name)}</span> : null}
      </div>
    </SettingsCard>
  )
}
