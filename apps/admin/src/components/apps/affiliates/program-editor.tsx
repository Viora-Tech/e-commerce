'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import ArchiveProgramDialog from '@/components/apps/affiliates/archive-program-dialog'
import CommissionPreview from '@/components/apps/affiliates/commission-preview'
import ProgramCalculation from '@/components/apps/affiliates/program-calculation'
import ProgramCommissionRules from '@/components/apps/affiliates/program-commission-rules'
import ProgramIncentives from '@/components/apps/affiliates/program-incentives'
import ProgramSignupCard from '@/components/apps/affiliates/program-signup-card'
import ProgramSummaryCard from '@/components/apps/affiliates/program-summary-card'
import SignupFormCard from '@/components/apps/affiliates/signup-form-card'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import BackLink from '@/components/layout/back-link'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import SaveBar from '@/components/layout/save-bar'
import SectionHead from '@/components/layout/section-head'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
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

/**
 * Affiliates › Edit program, laid out like UpPromote's: General information, Commission rules,
 * Customer incentives, Commission calculation and Other settings (signup page and questions) in
 * the main column; the Summary in a sticky side column. Saved with the SaveBar.
 */
export default function ProgramEditor({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(affiliatesContent)
  const { editor } = useCopy(affiliatesLayoutContent)
  const apps = useCopy(appsContent)
  const [program, setProgram] = useState<Program | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [reload, setReload] = useState(0)
  /** Bumped on save and discard, so the rules section drops its own picks (the Rule select). */
  const [version, setVersion] = useState(0)
  /** The read failed: Try again instead of a blank page. */
  const [failed, setFailed] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    const id = params.id ?? ''
    setFailed(false)
    Promise.all([
      api.affiliates.programs.get({ id }),
      api.affiliates.programs.list(),
      api.store.origin(),
    ]).then(
      ([p, all, o]) => {
        if (cancelled) return
        setProgram(p)
        setForm({ name: p.name, slug: p.slug, rules: p.rules })
        setTargets(
          all
            .filter((x) => x.id !== p.id && !x.archivedAt)
            .map((x) => ({ id: x.id, name: x.name, isDefault: x.isDefault })),
        )
        setOrigin(o)
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
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
      setVersion((n) => n + 1)
      toast.success(copy.program.saved)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }
  const handleDiscard = () => {
    setForm(program ? { name: program.name, slug: program.slug, rules: program.rules } : null)
    setVersion((n) => n + 1)
  }
  const handleRestore = async () => {
    if (!program) return
    await api.affiliates.programs.restore({ id: program.id })
    toast.success(copy.program.restored)
    setReload((n) => n + 1)
  }

  // Early returns
  if ((!program || !form) && failed) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink href={routes.apps.page('affiliates', 'programs')} label={copy.program.back} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.program}
          onRetry={() => setReload((n) => n + 1)}
        />
      </div>
    )
  }
  if (!program || !form) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <PageHeaderSkeleton back actions={1} />
        <DataCardSkeleton fields={2} />
        <DataCardSkeleton fields={3} />
        <DataCardSkeleton fields={0} lines={3} />
      </div>
    )
  }

  // Render logic
  const c = copy.program
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
    // A wider centred column than Home's: UpPromote's editor has a main and a side column.
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-5">
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
        title={editor.title}
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
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsCard title={editor.general}>
            <SettingsRow label={c.name} htmlFor="aff-program-name">
              <Input
                id="aff-program-name"
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </SettingsRow>
            <SettingsRow
              label={editor.description}
              description={editor.descriptionHelp}
              htmlFor="aff-pitch"
            >
              <Textarea
                id="aff-pitch"
                rows={3}
                maxLength={2000}
                value={form.rules.pitch}
                onChange={(e) => handleRules({ pitch: e.target.value })}
              />
            </SettingsRow>
          </SettingsCard>
          <ProgramCommissionRules key={version} rules={form.rules} onChange={handleRules} />
          <ProgramIncentives
            coupon={form.rules.coupon}
            onChange={(coupon) => handleRules({ coupon })}
          />
          <ProgramCalculation
            excludes={form.rules.excludes}
            onChange={(excludes) => handleRules({ excludes })}
          />
          <section className="flex flex-col gap-4">
            <SectionHead title={editor.sections.other} />
            <ProgramSignupCard
              isDefault={program.isDefault}
              link={link}
              slug={form.slug}
              rules={form.rules}
              onSlug={(slug) => setForm({ ...form, slug })}
              onChange={handleRules}
            />
            <SignupFormCard
              fields={form.rules.form}
              onChange={(fields) => handleRules({ form: fields })}
            />
            <CommissionPreview rules={form.rules} />
          </section>
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          <ProgramSummaryCard
            name={form.name}
            isDefault={program.isDefault}
            archived={Boolean(program.archivedAt)}
            rules={form.rules}
          />
        </div>
      </div>
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
