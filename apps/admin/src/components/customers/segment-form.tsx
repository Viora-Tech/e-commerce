'use client'

import type { SegmentRules } from '@commerce/core/segments'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ConditionBuilder from '@/components/rules/condition-builder'
import { segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DeleteSegmentButton from './delete-segment-button'
import SegmentPreview from './segment-preview'

type SegmentFormProps = {
  /** Absent for a new segment. */
  id?: string | undefined
  initialName: string
  initialRules: SegmentRules
}

export default function SegmentForm({ id, initialName, initialRules }: SegmentFormProps) {
  // Hooks
  const content = useCopy(segmentsContent)
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [rules, setRules] = useState<SegmentRules>(initialRules)
  const [saved, setSaved] = useState(() => JSON.stringify({ initialName, initialRules }))
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setSaved(JSON.stringify({ initialName, initialRules }))
  }, [initialName, initialRules])

  // Event handlers
  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(content.builder.nameRequired)
      return
    }
    setSaving(true)
    try {
      const row = await api.customers.saveSegment({ id, name: trimmed, rules })
      toast.success(content.builder.saved)
      setSaved(JSON.stringify({ initialName: trimmed, initialRules: rules }))
      if (!id && row) router.replace(routes.customers.segment(row.id))
      router.refresh()
    } catch {
      toast.error(content.builder.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    const previous = JSON.parse(saved) as { initialName: string; initialRules: SegmentRules }
    setName(previous.initialName)
    setRules(previous.initialRules)
  }

  // Render logic
  const builder = content.builder
  const dirty = JSON.stringify({ initialName: name, initialRules: rules }) !== saved

  return (
    <PageBody width="frame" className="gap-6">
      <SaveBar
        open={dirty}
        message={builder.conditions}
        saveLabel={builder.save}
        discardLabel={builder.cancel}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <PageHeader
        title={id ? name || builder.editHeading : builder.newHeading}
        back={{ label: builder.back, href: routes.customers.segments() }}
        actions={id ? <DeleteSegmentButton id={id} /> : null}
        save={{ dirty: true, saving, onSave: handleSave, label: builder.save }}
      />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Card size="form" className="rounded-xl">
            <CardContent>
              <Field>
                <FieldLabel htmlFor="segment-name">{builder.name}</FieldLabel>
                <Input
                  id="segment-name"
                  size="lg"
                  value={name}
                  placeholder={builder.namePlaceholder}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
          <Card size="form" className="rounded-xl">
            <CardHeader>
              <CardTitle>{builder.conditions}</CardTitle>
            </CardHeader>
            <CardContent>
              <ConditionBuilder rules={rules} onChange={setRules} />
            </CardContent>
          </Card>
        </div>
        <SegmentPreview rules={rules} />
      </div>
    </PageBody>
  )
}
