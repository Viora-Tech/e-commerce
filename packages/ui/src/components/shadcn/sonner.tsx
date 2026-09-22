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
      offset={20}
      gap={10}
      duration={4000}
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          '--success-bg': 'var(--popover)',
          '--success-text': 'var(--success)',
          '--error-bg': 'var(--popover)',
          '--error-text': 'var(--destructive)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast !rounded-lg !border-border !shadow-popover !px-4 !py-3 !gap-3 !text-body',
          title: '!font-medium !text-foreground',
          description: '!text-caption !text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground !rounded-md !text-caption',
          cancelButton: '!bg-muted !text-muted-foreground !rounded-md !text-caption',
          closeButton: '!border-border !bg-card !text-muted-foreground hover:!text-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
