'use client'

import {
  type ConditionFieldDescriptor,
  isRuleGroup,
  MAX_RULE_DEPTH,
  type Rule,
  type RuleGroup,
} from '@commerce/core/automations'
import { Plus, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { firstRule } from '@/lib/automation-tree'
import RuleRow from './rule-row'
import SelectInput from './select-input'

type RuleGroupEditorProps = {
  id: string
  group: RuleGroup
  fields: ConditionFieldDescriptor[]
  /** 1 for the condition's own group; groups nest at most `MAX_RULE_DEPTH` deep. */
  depth: number
  onChange: (group: RuleGroup) => void
  /** Set on nested groups. */
  onRemove?: (() => void) | undefined
}

/** An AND/OR group of rules (and, at the top, groups): All of these / Any of these. */
export default function RuleGroupEditor({
  id,
  group,
  fields,
  depth,
  onChange,
  onRemove,
}: RuleGroupEditorProps) {
  // Hooks
  const { condition: copy } = useCopy(automationEditorContent)

  // Helpers
  const setAt = (i: number, next: Rule | RuleGroup) =>
    onChange({ ...group, rules: group.rules.map((r, at) => (at === i ? next : r)) })
  const removeAt = (i: number) =>
    onChange({ ...group, rules: group.rules.filter((_, at) => at !== i) })

  // Render logic
  const joinWord = group.join === 'and' ? copy.and : copy.or

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        depth > 1 && 'rounded-lg border border-border border-dashed p-2.5',
      )}
    >
      <div className="flex items-center gap-2">
        <SelectInput
          id={`${id}-join`}
          aria-label={copy.all}
          value={group.join}
          options={[
            { value: 'and', label: copy.all },
            { value: 'or', label: copy.any },
          ]}
          onChange={(join) => onChange({ ...group, join: join as RuleGroup['join'] })}
        />
        {onRemove ? (
          <Button variant="ghost" size="icon-sm" aria-label={copy.removeGroup} onClick={onRemove}>
            <X />
          </Button>
        ) : null}
      </div>
      <ol className="flex flex-col gap-2">
        {group.rules.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rules have no id; their place is their identity
          <li key={i} className="flex flex-col gap-2">
            {i > 0 ? <span className="text-eyebrow text-muted-foreground">{joinWord}</span> : null}
            {isRuleGroup(r) ? (
              <RuleGroupEditor
                id={`${id}-${i}`}
                group={r}
                fields={fields}
                depth={depth + 1}
                onChange={(next) => setAt(i, next)}
                onRemove={() => removeAt(i)}
              />
            ) : (
              <RuleRow
                id={`${id}-${i}`}
                rule={r}
                fields={fields}
                onChange={(next) => setAt(i, next)}
                onRemove={() => removeAt(i)}
              />
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...group, rules: [...group.rules, firstRule(fields)] })}
        >
          <Plus aria-hidden="true" />
          {copy.addRule}
        </Button>
        {depth < MAX_RULE_DEPTH ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...group,
                rules: [
                  ...group.rules,
                  { join: group.join === 'and' ? 'or' : 'and', rules: [firstRule(fields)] },
                ],
              })
            }
          >
            <Plus aria-hidden="true" />
            {copy.addGroup}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
