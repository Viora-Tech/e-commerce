'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ConnectModeSwitch, ModeSwitch
 * WHAT:  the Test/Live switch on a provider app's Connect page, with a line explaining the choice.
 * WHY:   one owner for the switch; how the choice is stored differs per provider (Delhivery points
 *        the base URL at staging, Decentro saves a `mode` field), so that lives in `ModeSwitch`.
 * WHERE: ProviderConnectPage, when a provider passes `mode`.
 */

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import type { FieldValues } from './provider-settings'

type Mode = 'test' | 'live'

export type ModeSwitch = {
  read: (values: FieldValues) => Mode
  write: (mode: string, setField: (key: string, value: string) => void) => void
  copy: { label: string; test: string; live: string; help: { test: string; live: string } }
}

type ConnectModeSwitchProps = {
  providerId: string
  mode: ModeSwitch
  values: FieldValues
  setField: (key: string, value: string) => void
}

export default function ConnectModeSwitch({
  providerId,
  mode,
  values,
  setField,
}: ConnectModeSwitchProps) {
  // Event handlers
  const handleModeChange = (next: string[]) => {
    const picked = next[0]
    if (picked) mode.write(picked, setField)
  }

  // Render logic
  const current = mode.read(values)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span id={`${providerId}-mode-label`} className="text-body font-medium text-foreground">
          {mode.copy.label}
        </span>
        <ToggleGroup
          aria-labelledby={`${providerId}-mode-label`}
          value={[current]}
          onValueChange={handleModeChange}
          variant="outline"
          spacing={0}
        >
          <ToggleGroupItem value="test">{mode.copy.test}</ToggleGroupItem>
          <ToggleGroupItem value="live">{mode.copy.live}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-caption text-muted-foreground">{mode.copy.help[current]}</p>
    </>
  )
}
