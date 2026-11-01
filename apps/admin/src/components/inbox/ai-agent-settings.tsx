'use client'

import {
  INBOX_AI_KNOWLEDGE_MAX,
  INBOX_AI_MODES,
  INBOX_AI_VOICE_MAX,
  INBOX_QUESTION_MAX,
  INBOX_QUESTIONS_MAX,
  type InboxAiSettings,
} from '@commerce/core/inbox'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { inboxContent } from '@/data/inbox'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

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
        <SettingsRow label={a.voice.label} description={a.voice.help} htmlFor="inbox-ai-voice">
          <div className="flex flex-col gap-1">
            <Textarea
              id="inbox-ai-voice"
              rows={3}
              maxLength={INBOX_AI_VOICE_MAX}
              placeholder={a.voice.placeholder}
              value={value.voice}
              onChange={(e) => onChange({ ...value, voice: e.target.value })}
            />
            <span className="self-end text-caption text-muted-foreground tabular-nums">
              {a.voice.count(value.voice.length, INBOX_AI_VOICE_MAX)}
            </span>
          </div>
        </SettingsRow>
      )}
      <SettingsRow label={a.questions.label} description={a.questions.help}>
        <div className="flex flex-col gap-2">
          {Array.from({ length: INBOX_QUESTIONS_MAX }, (_, i) => (
            <Input
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed box per question slot
              key={i}
              aria-label={a.questions.slot(i + 1)}
              maxLength={INBOX_QUESTION_MAX}
              placeholder={i === 0 ? a.questions.placeholder : undefined}
              value={value.questions[i] ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  questions: Array.from({ length: INBOX_QUESTIONS_MAX }, (_, j) =>
                    j === i ? e.target.value : (value.questions[j] ?? ''),
                  ),
                })
              }
            />
          ))}
        </div>
      </SettingsRow>
      <SettingsRow label={a.knowledgeBase.label} description={a.knowledgeBase.help}>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          nativeButton={false}
          render={<Link href={routes.salesChannels.inboxKnowledge()} />}
        >
          {a.knowledgeBase.action}
        </Button>
      </SettingsRow>
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
