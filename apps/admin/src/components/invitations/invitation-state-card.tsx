import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { invitationContent } from '@/data/invitations'

type InvitationStateCardProps = {
  state: keyof typeof invitationContent.states
}

const copy = invitationContent

/** An invitation that can no longer be accepted: missing, used, withdrawn or expired. */
export default function InvitationStateCard({ state }: InvitationStateCardProps) {
  // Render logic
  const text = copy.states[state]

  return (
    <DataCard title={text.heading} className="w-full max-w-sm" bodyClassName="flex flex-col gap-4">
      <p className="text-body text-muted-foreground">{text.body}</p>
      <Button nativeButton={false} render={<Link href="/login" />} className="w-full">
        {copy.goToLogin}
      </Button>
    </DataCard>
  )
}
