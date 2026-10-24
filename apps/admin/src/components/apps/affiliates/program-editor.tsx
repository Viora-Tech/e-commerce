'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import ArchiveProgramDialog from '@/components/apps/affiliates/archive-program-dialog'
import CommissionPreview from '@/components/apps/affiliates/commission-preview'
import CommissionSettings from '@/components/apps/affiliates/commission-settings'
import ProgramExcludesCard from '@/components/apps/affiliates/program-excludes-card'
import ProgramLevelsCard from '@/components/apps/affiliates/program-levels-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Program = Awaited<ReturnType<typeof api.affiliates.programs.get>>
type Form = { name: string; slug: string; rules: ProgramRules }
type Target = { id: string; name: string; isDefault: boolean }

/** Rows with nothing picked yet are left out rather than refused. */
function cleanRules(rules: ProgramRules): ProgramRules {
  return {
    ...rules,
    overrides: rules.overrides.filter((o) => o.id),
    excludes: rules.excludes.filter((x) => x.id),
    tiers: rules.tiers.filter((t) => t.name.trim()),
  }
}

/** One program, full page: name and link, signup, commission, levels, exclusions and a preview. */
export default function ProgramEditor({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const [program, setProgram] = useState<Program | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    const id = params.id ?? ''
    Promise.all([
      api.affiliates.programs.get({ id }),
      api.affiliates.programs.list(),
      api.store.origin(),
    ]).then(([p, all, o]) => {
      if (cancelled) return
      setProgram(p)
      setForm({ name: p.name, slug: p.slug, rules: p.rules })
      setTargets(
        all
          .filter((x) => x.id !== p.id && !x.archivedAt)
          .map((x) => ({ id: x.id, name: x.name, isDefault: x.isDefault })),
      )
      setOrigin(o)
    })
    return () => {
      cancelled = true
    }
  }, [params.id, reload])

  // Event handlers
  const handleRules = (patch: Partial<ProgramRules>) =>
    setForm((f) => (f ? { ...f, rules: { ...f.rules, ...patch } } : f))
  const handleSave = async () => {
    if (!form || !program) return
    setBusy(true)
    try {
      const next = await api.affiliates.programs.save({
        id: program.id,
        name: form.name,
        slug: form.slug,
        rules: cleanRules(form.rules),
      })
      setProgram(next)
      setForm({ name: next.name, slug: next.slug, rules: next.rules })
      toast.success(copy.program.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleDiscard = () =>
    setForm(program ? { name: program.name, slug: program.slug, rules: program.rules } : null)
  const handleRestore = async () => {
    if (!program) return
    await api.affiliates.programs.restore({ id: program.id })
    toast.success(copy.program.restored)
    setReload((n) => n + 1)
  }

  // Early returns
  if (!program || !form) return null

  // Render logic
  const c = copy.program
  const s = copy.settings
  const saved = { name: program.name, slug: program.slug, rules: program.rules }
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const path = program.isDefault ? '/affiliate' : `/affiliate?program=${form.slug}`
  const link = `${origin.replace(/\/+$/, '')}${path}`
  const action = program.isDefault ? null : program.archivedAt ? (
    <Button variant="outline" onClick={handleRestore}>
      {c.restore}
    </Button>
  ) : (
    <Button variant="outline" onClick={() => setArchiving(true)}>
      {c.archive}
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={c.unsaved}
        saveLabel={c.save}
        discardLabel={c.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={program.name}
        back={{ label: c.back, href: routes.apps.page('affiliates', 'programs') }}
        badges={
          program.archivedAt ? (
            <StatusChip tone="neutral">{copy.programs.archived}</StatusChip>
          ) : program.isDefault ? (
            <StatusChip tone="info">{copy.programs.isDefault}</StatusChip>
          ) : null
        }
        actions={action}
      />
      {program.archivedAt ? (
        <p className="text-body text-muted-foreground">{c.archivedNote}</p>
      ) : null}
      <SettingsCard title={c.details}>
        <SettingsRow label={c.name} htmlFor="aff-program-name">
          <Input
            id="aff-program-name"
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </SettingsRow>
        {program.isDefault ? (
          <SettingsRow label={c.link} description={c.defaultLink}>
            <span className="break-all font-mono text-body">{link}</span>
          </SettingsRow>
        ) : (
          <SettingsRow label={c.slug} description={c.slugHelp} htmlFor="aff-program-slug">
            <div className="flex flex-col gap-1">
              <Input
                id="aff-program-slug"
                maxLength={40}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              />
              <span className="break-all font-mono text-caption text-muted-foreground">{link}</span>
            </div>
          </SettingsRow>
        )}
        <SettingsRow label={s.approval} htmlFor="aff-approval">
          <NativeSelect
            id="aff-approval"
            value={form.rules.approval}
            onChange={(e) =>
              handleRules({ approval: e.target.value === 'auto' ? 'auto' : 'manual' })
            }
          >
            <NativeSelectOption value="manual">{s.approvalManual}</NativeSelectOption>
            <NativeSelectOption value="auto">{s.approvalAuto}</NativeSelectOption>
          </NativeSelect>
        </SettingsRow>
      </SettingsCard>
      <CommissionSettings form={form.rules} onChange={handleRules} />
      <ProgramLevelsCard
        levels={form.rules.levels}
        onChange={(levels) => handleRules({ levels })}
      />
      <ProgramExcludesCard
        excludes={form.rules.excludes}
        onChange={(excludes) => handleRules({ excludes })}
      />
      <CommissionPreview rules={form.rules} />
      <SettingsCard title={s.page}>
        <SettingsRow label={s.pitch} description={s.pitchHelp} htmlFor="aff-pitch">
          <Textarea
            id="aff-pitch"
            rows={3}
            maxLength={2000}
            value={form.rules.pitch}
            onChange={(e) => handleRules({ pitch: e.target.value })}
          />
        </SettingsRow>
        <SettingsRow label={s.terms} description={s.termsHelp} htmlFor="aff-terms">
          <Textarea
            id="aff-terms"
            rows={6}
            maxLength={10_000}
            value={form.rules.terms}
            onChange={(e) => handleRules({ terms: e.target.value })}
          />
        </SettingsRow>
      </SettingsCard>
      <ArchiveProgramDialog
        open={archiving}
        onOpenChange={setArchiving}
        programId={program.id}
        targets={targets}
        onArchived={() => setReload((n) => n + 1)}
      />
    </div>
  )
}
