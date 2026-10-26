import { isPlanId } from '@commerce/core/billing'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { notFound } from 'next/navigation'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import IntegrationList from '@/components/platform/integration-list'
import { billingContent } from '@/data/billing'
import { platformContent as copy } from '@/data/platform'
import { appRouter, call } from '@/lib/api'
import { formatPaise } from '@/lib/money'
import { platformCallOptions } from '@/lib/platform-access'
import { planTone, storefrontHref } from '@/lib/platform-display'
import { uuidParam } from '@/lib/platform-params'
import { routes } from '@/lib/routes'

type StorePageProps = { params: Promise<{ id: string }> }

const planName = (plan: string) => (isPlanId(plan) ? billingContent.plans[plan].name : plan)

/** Platform console → one store: plan, domains, staff, apps, integrations and errors (staff only). */
export default async function PlatformStorePage({ params }: StorePageProps) {
  const id = uuidParam((await params).id)
  const options = await platformCallOptions()
  if (!id) notFound()
  const d = await call(appRouter.platform.stores.get, { id }, options).catch(() => null)
  if (!d) notFound()
  const t = copy.store
  const primary = d.domains.find((x) => x.isPrimary) ?? d.domains[0]
  const storefront = storefrontHref(primary?.hostname)

  return (
    <PageBody>
      <PageHeader
        title={d.store.name}
        subtitle={primary?.hostname ?? d.store.slug}
        back={{ label: t.back, href: routes.platform.stores() }}
        badges={
          d.plan ? (
            <StatusChip tone={planTone(d.plan.status)}>
              {planName(d.plan.plan)} · {d.plan.status}
            </StatusChip>
          ) : null
        }
        actions={
          storefront ? (
            <Button
              variant="outline"
              render={<a href={storefront} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink />
              {t.openStorefront}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title={copy.nav.stores}>
          <KeyValueList
            variant="grid"
            rows={[
              { label: t.storeId, value: d.store.id, copy: true, truncate: true },
              {
                label: t.organizationId,
                value: d.store.organizationId,
                copy: Boolean(d.store.organizationId),
                truncate: true,
              },
              { label: t.slug, value: d.store.slug, copy: true },
              { label: t.created, value: <RelativeTime value={d.store.createdAt} /> },
              { label: t.currency, value: d.store.currency },
              { label: t.timezone, value: d.store.timezone },
            ]}
          />
        </DataCard>

        <DataCard title={t.planTitle}>
          {d.plan ? (
            <div className="flex flex-col gap-4">
              <KeyValueList
                variant="grid"
                rows={[
                  { label: t.plan, value: `${planName(d.plan.plan)} · ${d.plan.interval}` },
                  { label: t.status, value: d.plan.status },
                  {
                    label: t.trialEnds,
                    value: d.plan.trialEndsAt ? <RelativeTime value={d.plan.trialEndsAt} /> : null,
                    hidden: d.plan.status !== 'trialing',
                  },
                  {
                    label: t.periodEnds,
                    value: d.plan.periodEnd ? <RelativeTime value={d.plan.periodEnd} /> : null,
                  },
                  {
                    label: t.nextPlan,
                    value: d.plan.nextPlan ? planName(d.plan.nextPlan) : null,
                    hidden: !d.plan.nextPlan,
                  },
                  { label: t.autopay, value: d.autopay ?? t.autopayOff },
                ]}
              />
              <div className="flex flex-col gap-2">
                <span className="text-eyebrow text-muted-foreground">{t.bills}</span>
                {d.bills.length === 0 ? (
                  <span className="text-body text-muted-foreground">{t.noBills}</span>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {d.bills.map((b) => (
                      <li key={b.number} className="flex items-center justify-between gap-3 py-2">
                        <span className="flex min-w-0 flex-col">
                          <span className="text-body-strong">{t.bill(b.number)}</span>
                          <span className="text-caption text-muted-foreground">
                            {planName(b.plan)} · {b.interval} ·{' '}
                            <RelativeTime value={b.periodStart} />
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{formatPaise(b.amountPaise)}</span>
                          <StatusChip
                            tone={
                              b.status === 'paid'
                                ? 'success'
                                : b.status === 'due'
                                  ? 'attention'
                                  : 'neutral'
                            }
                          >
                            {b.status}
                          </StatusChip>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">{t.noPlan}</p>
          )}
        </DataCard>

        <DataCard title={t.ordersTitle}>
          <KeyValueList
            variant="grid"
            rows={[
              { label: t.last7d, value: String(d.orders.last7d) },
              { label: t.last30d, value: String(d.orders.last30d) },
              { label: t.gmv30d, value: formatPaise(d.orders.gmv30dPaise), strong: true },
              { label: t.test30d, value: String(d.orders.test30d), tone: 'muted' },
              {
                label: t.lastOrder,
                value: d.orders.lastAt ? <RelativeTime value={d.orders.lastAt} /> : null,
              },
            ]}
          />
        </DataCard>

        <DataCard title={t.domainsTitle} count={d.domains.length}>
          {d.domains.length === 0 ? (
            <p className="text-body text-muted-foreground">{t.noDomains}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {d.domains.map((x) => (
                <li key={x.hostname} className="group/row flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">{x.hostname}</span>
                  <CopyButton value={x.hostname} what={t.domainsTitle} />
                  {x.isPrimary ? <StatusChip tone="info">{t.primary}</StatusChip> : null}
                  <StatusChip tone={x.status === 'active' ? 'success' : 'attention'}>
                    {x.kind} · {x.status}
                  </StatusChip>
                  <StatusChip tone={x.sslStatus === 'active' ? 'success' : 'attention'}>
                    {t.ssl} · {x.sslStatus}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )}
        </DataCard>

        <DataCard title={t.staffTitle} count={d.staff.length}>
          {d.staff.length === 0 ? (
            <p className="text-body text-muted-foreground">{t.noStaff}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {d.staff.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong">{m.name ?? copy.dash}</span>
                    <span className="truncate text-caption text-muted-foreground">
                      {m.email ?? m.userId}
                    </span>
                  </span>
                  <StatusChip tone={m.status === 'active' ? 'neutral' : 'attention'}>
                    {m.role} · {m.status}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )}
        </DataCard>

        <DataCard title={t.appsTitle} count={d.apps.length}>
          {d.apps.length === 0 ? (
            <p className="text-body text-muted-foreground">{t.noApps}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {d.apps.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 py-2">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-mono text-caption">{a.id}</span>
                    {a.installedAt ? <RelativeTime value={a.installedAt} /> : null}
                  </span>
                  {a.lastError ? (
                    <span className="text-caption text-danger">
                      {t.lastError}: {a.lastError}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DataCard>

        <DataCard title={t.integrationsTitle} subtitle={t.integrationsNote}>
          <div className="flex flex-col gap-4">
            <IntegrationList label={t.payments} items={d.integrations.payments} />
            <IntegrationList label={t.shipping} items={d.integrations.shipping} />
            <IntegrationList label={t.notifications} items={d.integrations.notifications} />
            <IntegrationList
              label={t.channels}
              items={d.integrations.channels.map((c) => ({
                id: c.provider,
                enabled: true,
                configured: true,
              }))}
            />
          </div>
        </DataCard>

        <DataCard title={t.errorsTitle} count={d.errors.length}>
          {d.errors.length === 0 ? (
            <p className="text-body text-muted-foreground">{t.noErrors}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {d.errors.map((e) => (
                <li
                  key={`${e.source}-${e.at.toISOString()}-${e.what}`}
                  className="flex flex-col gap-0.5 py-2"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-body-strong">
                      {t.sources[e.source]} · {e.what}
                    </span>
                    <RelativeTime value={e.at} className="text-caption text-muted-foreground" />
                  </span>
                  <span className="text-caption break-words text-danger">{e.error}</span>
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </div>
    </PageBody>
  )
}
