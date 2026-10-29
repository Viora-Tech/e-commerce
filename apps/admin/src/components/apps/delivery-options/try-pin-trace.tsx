'use client'

import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { TryPinResult } from './format'

type TryPinTraceProps = {
  result: TryPinResult
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

type Why = NonNullable<TryPinResult['trace']['options'][number]['why']>

/**
 * Try a PIN's trace: for each option, every route's quote (cost, insurance, date, COD, live or
 * cache and how long it took), why each was dropped, which won and why, and which rules fired.
 */
export default function TryPinTrace({ result }: TryPinTraceProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const fmt = useFormat()

  // Helpers
  const whyText = (why: Why) =>
    why.kind === 'prefer_direct'
      ? copy.tryPin.why.prefer_direct(fmt.money(why.withinPaise))
      : why.kind === 'rule_default'
        ? copy.tryPin.why.rule_default(why.ruleName)
        : copy.tryPin.why[why.kind]

  // Render logic
  const t = copy.tryPin

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-ink-strong">{t.providers}</p>
        {result.trace.providers.map((p) => (
          <p key={p.providerId} className="text-caption text-muted-foreground">
            {p.status === 'failed'
              ? t.failed(p.providerLabel, p.error ?? '')
              : p.serviceable === false
                ? t.saidNo(p.providerLabel)
                : `${p.providerLabel}: ${p.source === 'cache' ? t.cache : t.live(p.ms)}`}
          </p>
        ))}
      </div>
      {result.trace.options.map((o) => (
        <div key={o.optionId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-medium text-ink-strong">{t.traceTitle(o.name)}</p>
            {o.hidden ? <StatusChip tone="neutral">{t.hidden[o.hidden]}</StatusChip> : null}
            {o.why ? <StatusChip tone="success">{whyText(o.why)}</StatusChip> : null}
          </div>
          {o.rulesApplied.length ? (
            <p className="text-caption text-muted-foreground">
              {t.rulesApplied(o.rulesApplied.map((r) => r.name).join(', '))}
            </p>
          ) : null}
          {o.rulesOverruled.length ? (
            <p className="text-caption text-warning">
              {t.rulesOverruled(o.rulesOverruled.map((r) => r.name).join(', '))}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">{t.columns.route}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.columns.cost}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.columns.insurance}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.columns.arrives}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.columns.cod}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.columns.source}</th>
                  <th className="py-1.5 font-medium">{t.columns.result}</th>
                </tr>
              </thead>
              <tbody>
                {o.routes.map((r) => (
                  <tr
                    key={r.key}
                    className={`border-t border-hairline ${r.dropped && r.dropped !== 'wrong_speed' ? 'text-muted-foreground' : 'text-ink-strong'}`}
                  >
                    <td className="py-1.5 pr-3">
                      {r.carrier} · {r.serviceLabel} ({r.providerLabel})
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {r.costPaise === null ? '—' : fmt.money(r.costPaise)}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {r.insures
                        ? r.insurancePaise === null
                          ? '—'
                          : fmt.money(r.insurancePaise)
                        : copy.routes.no}
                    </td>
                    <td className="py-1.5 pr-3">
                      {r.latest ? fmt.pattern(r.latest, SHORT_DATE) : '—'}
                      {r.etaEstimated ? ` (${t.estimated})` : ''}
                    </td>
                    <td className="py-1.5 pr-3">
                      {r.codAvailable === false ? copy.routes.no : copy.routes.yes}
                    </td>
                    <td className="py-1.5 pr-3">{r.source === 'cache' ? t.cache : t.live(r.ms)}</td>
                    <td className="py-1.5">
                      {o.winner === r.key ? (
                        <StatusChip tone="success">{t.winner}</StatusChip>
                      ) : r.dropped ? (
                        t.dropped[r.dropped]
                      ) : (
                        t.fits
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
