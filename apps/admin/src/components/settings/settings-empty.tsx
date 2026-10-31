import type { LucideIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import type { SectionEmptyContent } from '@/components/layout/section-empty'

type SettingsEmptyProps = SectionEmptyContent & { icon: LucideIcon }

/** Empty state for a settings tab that has nothing to configure yet; the layout supplies the frame. */
export default function SettingsEmpty({ heading, body, action, icon }: SettingsEmptyProps) {
  return (
    <Card inset="y-10">
      <EmptyState
        heading={heading}
        body={body}
        icon={icon}
        action={
          action ? (
            <Button variant="outline" nativeButton={false} render={<Link href={action.href} />}>
              {action.label}
            </Button>
          ) : undefined
        }
      />
    </Card>
  )
}
