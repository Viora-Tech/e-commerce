'use client'

import { INBOX_AI_KNOWLEDGE_MAX, INBOX_AI_MODES, type InboxAiSettings } from '@commerce/core/inbox'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { inboxContent } from '@/data/inbox'
import { useCopy } from '@/hooks/use-copy'

type AiAgentSettingsProps = {
  value: InboxAiSettings
  onChange: (next: InboxAiSettings) => void
}

/** Inbox settings › AI agent: when the AI answers shoppers and what it knows beyond the catalogue. */
export default function AiAgentSettings({ value, onChange }: AiAgentSettingsProps) {
  // Hooks
  const copy = useCopy(inboxContent)

  // Render logic
  const a = copy.settings.ai

  return (
    <SettingsCard title={a.title} description={a.description}>
      <SettingsRow label={a.mode.label} description={a.usage} htmlFor="inbox-ai-mode">
        <NativeSelect
          id="inbox-ai-mode"
          value={value.mode}
          onChange={(e) =>
            onChange({
              ...value,
              mode: INBOX_AI_MODES.find((m) => m === e.target.value) ?? 'off',
            })
          }
        >
          {INBOX_AI_MODES.map((m) => (
            <NativeSelectOption key={m} value={m}>
              {a.mode.options[m]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </SettingsRow>
      {value.mode === 'off' ? null : (
        <SettingsRow label={a.learn.label} description={a.learn.help} htmlFor="inbox-ai-learn">
          <Switch
            id="inbox-ai-learn"
            checked={value.learn}
            onCheckedChange={(learn) => onChange({ ...value, learn })}
          />
        </SettingsRow>
      )}
      {value.mode === 'off' ? null : (
        <SettingsRow
          label={a.knowledge.label}
          description={a.knowledge.help}
          htmlFor="inbox-ai-knowledge"
        >
          <div className="flex flex-col gap-1">
            <Textarea
              id="inbox-ai-knowledge"
              rows={5}
              maxLength={INBOX_AI_KNOWLEDGE_MAX}
              placeholder={a.knowledge.placeholder}
              value={value.knowledge}
              onChange={(e) => onChange({ ...value, knowledge: e.target.value })}
            />
            <span className="self-end text-caption text-muted-foreground tabular-nums">
              {a.knowledge.count(value.knowledge.length, INBOX_AI_KNOWLEDGE_MAX)}
            </span>
          </div>
        </SettingsRow>
      )}
    </SettingsCard>
  )
}
