'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from '../../icons'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      position="bottom-right"
      richColors
      offset={20}
      gap={10}
      duration={4000}
      closeButton
      style={
        {
          '--normal-bg': 'var(--glass-popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--hairline)',
          '--border-radius': 'var(--radius)',
          /* Rich colours: the whole toast is tinted with the kit's status hue, mixed into the popover. */
          '--success-bg': 'color-mix(in oklab, var(--success) 14%, var(--popover))',
          '--success-border': 'color-mix(in oklab, var(--success) 38%, var(--popover))',
          '--success-text': 'var(--success)',
          '--warning-bg': 'color-mix(in oklab, var(--warning) 16%, var(--popover))',
          '--warning-border': 'color-mix(in oklab, var(--warning) 42%, var(--popover))',
          '--warning-text': 'var(--warning)',
          '--error-bg': 'color-mix(in oklab, var(--danger) 12%, var(--popover))',
          '--error-border': 'color-mix(in oklab, var(--danger) 36%, var(--popover))',
          '--error-text': 'var(--danger)',
          '--info-bg': 'color-mix(in oklab, var(--info) 12%, var(--popover))',
          '--info-border': 'color-mix(in oklab, var(--info) 36%, var(--popover))',
          '--info-text': 'var(--info)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          /* Proofly toast: glass for plain toasts; success/error/warning/info are tinted (rich colours). */
          toast:
            'cn-toast !rounded-lg !shadow-glass !px-4 !py-3 !gap-3 !text-body [&:not([data-type=success]):not([data-type=error]):not([data-type=warning]):not([data-type=info])]:!border-glass-border [&:not([data-type=success]):not([data-type=error]):not([data-type=warning]):not([data-type=info])]:!bg-glass-popover [&:not([data-type=success]):not([data-type=error]):not([data-type=warning]):not([data-type=info])]:!backdrop-blur-xl [&:not([data-type=success]):not([data-type=error]):not([data-type=warning]):not([data-type=info])]:!backdrop-saturate-150 [@media(prefers-reduced-transparency:reduce)]:!backdrop-filter-none [@media(prefers-reduced-transparency:reduce)]:[&:not([data-type=success]):not([data-type=error]):not([data-type=warning]):not([data-type=info])]:!bg-raised',
          title: '!font-medium',
          description: '!text-caption !text-current !opacity-80',
          actionButton: '!bg-primary-soft !text-link !rounded-md !text-caption !font-medium',
          cancelButton: '!bg-muted !text-muted-foreground !rounded-md !text-caption',
          closeButton: '!border-hairline !bg-raised !text-muted-foreground hover:!text-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
