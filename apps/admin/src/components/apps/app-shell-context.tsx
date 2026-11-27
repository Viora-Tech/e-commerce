'use client'

import { createContext, type ReactNode, useContext } from 'react'

/** What a page that draws the app's actions in its own header needs from the shell. */
export type AppShellInfo = {
  appId: string
  name: string
  /** The app's settings page, for the "…" menu's Settings item; left out when it has none. */
  settingsHref?: string | undefined
}

type AppShellContextProps = { value: AppShellInfo; children: ReactNode }

const Ctx = createContext<AppShellInfo | null>(null)

/**
 * The app shell's details, for a page listed in the registry's `ownHeader`: the shell draws no
 * floating actions there, and the page puts the app's Settings and Uninstall in its own "…" menu
 * so its header has one row and one menu (owner, 28 Nov 2026). `null` outside an app page.
 */
export function useAppShell(): AppShellInfo | null {
  return useContext(Ctx)
}

/** Hands the shell's details to the page below it (`useAppShell`). */
export default function AppShellContext({ value, children }: AppShellContextProps) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
