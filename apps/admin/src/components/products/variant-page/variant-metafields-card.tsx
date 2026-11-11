'use client'

import { type FieldValidations, METAFIELD_OWNER_PERMISSIONS } from '@commerce/core/metaobjects'
import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import FieldInput from '@/components/metaobjects/field-input'
import { CUSTOM_DATA_OWNERS } from '@/data/custom-data'
import { metafieldsCardContent } from '@/data/metaobjects'
import { variantPageContent } from '@/data/variant-page'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { routes } from '@/lib/routes'
import type { VariantMetafieldDefinition } from './use-variant-metafields'

type VariantMetafieldsCardProps = {
  /** Null while loading; empty hides the card (the store has no variant fields). */
  definitions: VariantMetafieldDefinition[] | null
  values: Record<string, unknown>
  errors: Record<string, string>
  onChange: (definitionId: string, value: unknown) => void
}

/**
 * The variant's own metafields on its page, one input per variant field from Settings → Custom
 * data → Variants. The page holds the values and saves them with the variant (one save bar).
 */
export default function VariantMetafieldsCard({
  definitions,
  values,
  errors,
  onChange,
}: VariantMetafieldsCardProps) {
  // Hooks
  const fieldsCopy = useCopy(metafieldsCardContent)
  const { metafields: copy } = useCopy(variantPageContent)
  const { hasPermission } = usePermissions()

  // Early returns
  if (definitions !== null && definitions.length === 0) return null

  // Render logic
  const canWrite = hasPermission(METAFIELD_OWNER_PERMISSIONS.variant.write)
  const canManage = hasPermission(permissions.CONTENT_MANAGE_TYPES)
  const manageHref = routes.settings.customDataOwner(
    CUSTOM_DATA_OWNERS.find((o) => o.owner === 'variant')?.slug ?? '',
  )

  return (
    <DataCard
      title={copy.heading}
      subtitle={copy.help}
      action={
        canManage ? (
          <Button variant="ghost" render={<Link href={manageHref} />} nativeButton={false}>
            {fieldsCopy.manage}
          </Button>
        ) : null
      }
    >
      {definitions === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <fieldset disabled={!canWrite} className="contents">
          <FieldGroup>
            {definitions.map((d) => (
              <FieldInput
                key={d.id}
                rule={{ ...d, validations: d.validations as FieldValidations }}
                value={values[d.id]}
                error={errors[d.id]}
                onChange={(value) => onChange(d.id, value)}
              />
            ))}
          </FieldGroup>
        </fieldset>
      )}
    </DataCard>
  )
}
