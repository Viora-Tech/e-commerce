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
          '--normal-bg': 'var(--raised)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--hairline)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          /* Proofly toast: raised surface, hairline, Elevation/2; the status shows only in the icon. */
          toast:
            'cn-toast !rounded-lg !border-hairline !bg-raised !shadow-popover !px-4 !py-3 !gap-3 !text-body [&[data-type=success]_[data-icon]]:text-success [&[data-type=error]_[data-icon]]:text-danger [&[data-type=warning]_[data-icon]]:text-warning [&[data-type=info]_[data-icon]]:text-info',
          title: '!font-medium !text-foreground',
          description: '!text-caption !text-muted-foreground',
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
