'use client'

import type { ComponentProps, ContextType, ReactNode } from 'react'
import {
  LiquidHeadContext,
  LiquidThemeSettingsContext,
  OpenTemplateContext,
  PreviewModeContext,
  ThemePreviewContext,
} from '@/lib/customize-theme-context'
import { DynamicSourceContext } from '@/lib/dynamic-sources'
import ImportedThemeProvider from './imported-theme-provider'

type CustomizeContextsProps = {
  /** The theme settings the preview renders with. */
  settings: ContextType<typeof ThemePreviewContext>
  /** An imported theme's head for the canvas. */
  liquidHead: ContextType<typeof LiquidHeadContext>
  /** An imported theme's Theme settings, with unsaved changes in place. */
  liquidChanges: ContextType<typeof LiquidThemeSettingsContext>
  liquidInfo: ComponentProps<typeof ImportedThemeProvider>['info']
  liquidFields: ComponentProps<typeof ImportedThemeProvider>['fields']
  mode: ContextType<typeof PreviewModeContext>
  sourceScope: ContextType<typeof DynamicSourceContext>
  /** The template open on the canvas. */
  template: ContextType<typeof OpenTemplateContext>
  children: ReactNode
}

/** The contexts the Customize canvas and panels read, nested in the order the editor sets them. */
export default function CustomizeContexts({
  settings,
  liquidHead,
  liquidChanges,
  liquidInfo,
  liquidFields,
  mode,
  sourceScope,
  template,
  children,
}: CustomizeContextsProps) {
  return (
    <ThemePreviewContext.Provider value={settings}>
      <LiquidHeadContext.Provider value={liquidHead}>
        <LiquidThemeSettingsContext.Provider value={liquidChanges}>
          <ImportedThemeProvider info={liquidInfo} fields={liquidFields}>
            <PreviewModeContext.Provider value={mode}>
              <DynamicSourceContext.Provider value={sourceScope}>
                <OpenTemplateContext.Provider value={template}>
                  {children}
                </OpenTemplateContext.Provider>
              </DynamicSourceContext.Provider>
            </PreviewModeContext.Provider>
          </ImportedThemeProvider>
        </LiquidThemeSettingsContext.Provider>
      </LiquidHeadContext.Provider>
    </ThemePreviewContext.Provider>
  )
}
