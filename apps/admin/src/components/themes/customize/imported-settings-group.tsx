'use client'

import { settingDefaults, type ThemeSettingsGroup } from '@commerce/core/theme-import'
import { ChevronLeftIcon } from '@commerce/ui/icons'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import ImportedColourSchemes from './imported-colour-schemes'
import ImportedSettingField from './imported-setting-field'

type ImportedSettingsGroupProps = {
  group: ThemeSettingsGroup
  /** Every Theme settings value, by setting id. */
  values: Record<string, unknown>
  locale: Record<string, unknown>
  colorSchemes: string[]
  onChange: (values: Record<string, unknown>) => void
  onBack: () => void
}

/**
 * One group of an imported theme's Theme settings, opened in place (as our own Theme
 * settings open a group): a way back, the group's name, then each of its settings; a setting
 * the theme never saved shows its default.
 */
export default function ImportedSettingsGroup({
  group,
  values,
  locale,
  colorSchemes,
  onChange,
  onBack,
}: ImportedSettingsGroupProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)

  // Event handlers
  const handleSet = (id: string, next: unknown) => onChange({ ...values, [id]: next })

  // Render logic
  const current = { ...settingDefaults(group.settings), ...values }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
        <button
          type="button"
          onClick={onBack}
          className={`-ml-1 flex items-center gap-1 self-start rounded-md px-1 text-xs leading-[1.0625rem] text-muted-foreground hover:text-foreground ${CHROME_FOCUS}`}
        >
          <ChevronLeftIcon aria-hidden className="size-3.5" />
          {copy.back}
        </button>
        <h2 className="text-base leading-[1.4375rem] font-semibold text-foreground">
          {group.name}
        </h2>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        {group.settings.map((s, i) => {
          const key = s.id ?? `${s.type}-${i}`
          if (s.type === 'color_scheme_group' && s.id) {
            const id = s.id
            return (
              <ImportedColourSchemes
                key={key}
                setting={s}
                value={current[id]}
                locale={locale}
                onChange={(next) => handleSet(id, next)}
              />
            )
          }
          return (
            <ImportedSettingField
              key={key}
              setting={s}
              value={s.id ? current[s.id] : undefined}
              locale={locale}
              colorSchemes={colorSchemes}
              onChange={(next) => s.id && handleSet(s.id, next)}
            />
          )
        })}
      </div>
    </div>
  )
}
