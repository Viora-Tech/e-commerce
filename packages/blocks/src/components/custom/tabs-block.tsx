import type { ReactNode } from 'react'
import { asSlot } from '../../slot-types'
import ElementBox from './element-box'
import TabsSwitcher from './tabs-switcher'

/** Tab labels are strings in storage, React nodes while edited on the canvas. */
export type TabsProps = { tabs: { label: ReactNode; content: unknown }[]; style: unknown }

/**
 * Tabs whose panels are slots. The panels are drawn here (on the server on the
 * storefront) and handed to a small client switcher, so only the tab buttons
 * need JavaScript and the first panel is in the server HTML.
 */
export default function TabsBlock({ tabs, style }: TabsProps) {
  // Render logic
  const items = tabs ?? []
  const panels = items.map((tab, i) => {
    const Panel = asSlot(tab?.content)
    // biome-ignore lint/suspicious/noArrayIndexKey: panels pair with their tab by position.
    return <Panel key={i} className="flex flex-col gap-4" minEmptyHeight={96} />
  })

  return (
    <ElementBox look={style} className="custom-tabs w-full">
      <TabsSwitcher labels={items.map((t) => t?.label ?? '')} panels={panels} />
    </ElementBox>
  )
}
