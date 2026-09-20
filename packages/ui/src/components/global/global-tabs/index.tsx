'use client'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/next'
import { Activity, useState } from 'react'
import { cn } from '../../../lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shadcn/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../shadcn/tooltip'

/**
 * Global Component - Tabs (React 19.2 optimized)
 *
 * Uses React 19.2's Activity component to preserve state across tab switches.
 * All tab contents remain mounted, improving performance and maintaining state.
 * Animated sliding indicator on active tab using motion layoutId.
 *
 * @param props.defaultValue - default select tab
 * @param props.items - all tabs @see {@link TabItem | items type}
 * @returns
 */

interface TabItem {
  value: string
  label: string | React.ReactNode
  content: React.ReactNode
  disabled?: boolean
  disabledTooltip?: string
}

interface GlobalTabsProps {
  defaultValue?: string
  tabs: TabItem[]
  rightContent?: (activeTab: string) => React.ReactNode
  queryState?: string
  /** Merged into the root `Tabs` element (e.g. height / overflow for scroll regions) */
  className?: string
  contentClassName?: string
  tabsListClassName?: string
  tabsTriggerClassName?: string
}

const GlobalTabsContent = ({
  defaultValue,
  tabs,
  queryState = 'tab',
  rightContent,
  className,
  contentClassName,
  tabsListClassName: customTabsListClassName,
  tabsTriggerClassName: customTabsTriggerClassName,
}: GlobalTabsProps) => {
  const [tab, setTab] = useQueryState(queryState)
  const [hovered, setHovered] = useState<string | null>(null)

  const fallbackTab = defaultValue ?? tabs.find((t) => !t.disabled)?.value ?? tabs[0]?.value ?? ''

  const activeTab = tab && tabs.some((t) => t.value === tab && !t.disabled) ? tab : fallbackTab

  const tabsListClassName = cn(
    'inline-flex h-auto min-h-0 w-fit max-w-full flex-wrap items-stretch justify-start gap-2 self-start overflow-visible rounded-xl bg-transparent p-1 text-muted-foreground',
    customTabsListClassName,
  )

  const triggerClassName =
    customTabsTriggerClassName ??
    'relative h-auto rounded-xl border-0 bg-transparent px-4 py-2 text-xs shadow-none hover:bg-transparent aria-selected:bg-transparent aria-selected:shadow-none dark:aria-selected:bg-transparent sm:text-sm'

  const renderTabTrigger = (tabItem: TabItem) => {
    const trigger = (
      <TabsTrigger
        aria-disabled={tabItem.disabled}
        className={cn(triggerClassName, tabItem.disabled && 'cursor-not-allowed opacity-40')}
        disabled={tabItem.disabled}
        key={tabItem.value}
        onClick={() => void setTab(tabItem.value)}
        onMouseEnter={() => {
          if (!tabItem.disabled) setHovered(tabItem.value)
        }}
        value={tabItem.value}
      >
        <span
          className={cn(
            'relative z-[1] inline-flex flex-row items-center gap-1.5',
            activeTab === tabItem.value ? 'text-secondary-foreground' : 'text-muted-foreground',
          )}
        >
          {tabItem.label}
        </span>
        {activeTab === tabItem.value && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-secondary/90 shadow-top dark:bg-secondary/90"
            layoutId="globalTabIndicator"
            transition={{
              type: 'spring',
              duration: 0.7,
              bounce: 0.15,
            }}
          />
        )}
        {hovered === tabItem.value && activeTab !== tabItem.value && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-secondary/50"
            layoutId="globalTabHover"
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
          />
        )}
      </TabsTrigger>
    )

    if (tabItem.disabled && tabItem.disabledTooltip) {
      return (
        <Tooltip key={tabItem.value}>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">{trigger}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tabItem.disabledTooltip}</TooltipContent>
        </Tooltip>
      )
    }

    return trigger
  }

  return (
    <Tabs className={cn('flex min-h-0 w-full flex-1 flex-col gap-4', className)} value={activeTab}>
      <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div className="min-w-0 w-full overflow-x-auto sm:w-auto sm:overflow-visible">
          <TabsList className={tabsListClassName} onMouseLeave={() => setHovered(null)}>
            {tabs.map((tabItem) => renderTabTrigger(tabItem))}
          </TabsList>
        </div>
        {rightContent && (
          <div className="flex w-full shrink-0 items-center overflow-visible sm:w-auto">
            {rightContent(activeTab)}
          </div>
        )}
      </div>

      {tabs.map((item) => (
        <Activity key={item.value} mode={activeTab === item.value ? 'visible' : 'hidden'}>
          <TabsContent
            className={cn('flex min-h-0 min-w-0 flex-1 flex-col', contentClassName)}
            value={item.value}
          >
            {item.content}
          </TabsContent>
        </Activity>
      ))}
    </Tabs>
  )
}

const GlobalTabs = (props: GlobalTabsProps) => {
  return (
    <NuqsAdapter>
      <GlobalTabsContent {...props} />
    </NuqsAdapter>
  )
}

export default GlobalTabs
