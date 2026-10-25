'use client'

import { RETURN_REASONS, type ReturnPolicy, type ReturnReason } from '@commerce/core/returns'
import { parseRupees } from '@commerce/money'
import { Input } from '@commerce/ui/shadcn/input'
import { returnRulesContent, returnsContent } from '@/data/returns'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'
import SettingsRow from './settings-row'
import SettingsToggleRow from './settings-toggle-row'

type ReturnsRulesCardProps = {
  policy: ReturnPolicy
  onPatch: (p: Partial<ReturnPolicy>) => void
}

const RUPEE = 100

/** Settings → Returns: exchanges for another variant, and the auto-approve rule. */
export default function ReturnsRulesCard({ policy, onPatch }: ReturnsRulesCardProps) {
  // Hooks
  const copy = useCopy(returnRulesContent)
  const labels = useCopy(returnsContent)

  // Helpers
  const patchAuto = (p: Partial<ReturnPolicy['autoApprove']>) =>
    onPatch({ autoApprove: { ...policy.autoApprove, ...p } })

  // Event handlers
  const handleReason = (code: ReturnReason, on: boolean) => {
    const current = policy.autoApprove.reasons
    const next = on ? [...current, code] : current.filter((r) => r !== code)
    patchAuto({ reasons: RETURN_REASONS.filter((r) => next.includes(r)) })
  }

  // Render logic
  const auto = policy.autoApprove

  return (
    <>
      <SettingsCard title={copy.exchangesTitle}>
        <SettingsToggleRow
          id="returns-exchanges"
          label={copy.exchanges}
          description={copy.exchangesHint}
          checked={policy.exchanges}
          onChange={(exchanges) => onPatch({ exchanges })}
        />
      </SettingsCard>

      <SettingsCard title={copy.autoTitle} description={copy.autoDescription}>
        <SettingsToggleRow
          id="returns-auto"
          label={copy.auto}
          checked={auto.enabled}
          onChange={(enabled) => patchAuto({ enabled })}
        />
        {auto.enabled ? (
          <>
            <SettingsRow
              label={copy.autoMax}
              description={copy.autoMaxHint}
              htmlFor="returns-auto-max"
            >
              <Input
                size="lg"
                id="returns-auto-max"
                type="number"
                inputMode="numeric"
                min="0"
                className="w-32"
                value={auto.maxValuePaise / RUPEE}
                onChange={(e) =>
                  patchAuto({ maxValuePaise: Math.max(0, parseRupees(e.target.value) ?? 0) })
                }
              />
            </SettingsRow>
            <SettingsRow label={copy.autoReasons}>
              <div className="flex flex-col">
                {policy.reasons.map((code) => (
                  <SettingsToggleRow
                    key={code}
                    id={`auto-reason-${code}`}
                    label={labels.reasons[code]}
                    checked={auto.reasons.includes(code)}
                    onChange={(on) => handleReason(code, on)}
                    className="py-3"
                  />
                ))}
              </div>
            </SettingsRow>
          </>
        ) : null}
      </SettingsCard>
    </>
  )
}
