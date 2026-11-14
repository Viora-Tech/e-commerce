import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * The one banner (admin audit step 10, 14 Nov 2026): a hairline box with an optional lead glyph,
 * a title, plain words and an optional action at the end. One radius (`rounded-lg`), one padding
 * and five tones, each drawn from the status tokens, so a red banner is red the same way
 * everywhere. `variant="destructive"` is the older name for `tone="danger"`.
 */
const alertVariants = cva(
  "group/alert relative grid w-full items-start gap-x-3 gap-y-0.5 rounded-lg border px-4 py-3 text-left text-sm has-[>svg]:grid-cols-[auto_minmax(0,1fr)] has-data-[slot=alert-action]:grid-cols-[minmax(0,1fr)_auto] has-[>svg]:has-data-[slot=alert-action]:grid-cols-[auto_minmax(0,1fr)_auto] *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      tone: {
        neutral: 'border-border bg-card text-card-foreground *:[svg]:text-muted-foreground',
        info: 'border-info-border bg-info-soft text-foreground *:[svg]:text-info',
        success: 'border-success-border bg-success-soft text-foreground *:[svg]:text-success',
        warning: 'border-warning-border bg-warning-soft text-foreground *:[svg]:text-warning',
        danger: 'border-danger-border bg-danger-soft text-foreground *:[svg]:text-danger',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

type AlertTone = NonNullable<VariantProps<typeof alertVariants>['tone']>

type AlertProps = React.ComponentProps<'div'> & {
  tone?: AlertTone | undefined
  /** Older name: `destructive` is `tone="danger"`. */
  variant?: 'default' | 'destructive' | undefined
  /** A button or link at the end of the banner ("Fix", "Try again"). */
  action?: React.ReactNode
}

function Alert({ className, tone, variant, action, children, ...props }: AlertProps) {
  const resolved: AlertTone = tone ?? (variant === 'destructive' ? 'danger' : 'neutral')
  return (
    <div
      data-slot="alert"
      data-tone={resolved}
      role={resolved === 'danger' || resolved === 'warning' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone: resolved }), className)}
      {...props}
    >
      {children}
      {action ? <AlertAction>{action}</AlertAction> : null}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-sm text-balance text-muted-foreground group-has-[>svg]/alert:col-start-2 md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
        className,
      )}
      {...props}
    />
  )
}

/** The end slot: its own column at the end, centred on the text. */
function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        'row-span-2 row-start-1 -col-end-1 flex items-center gap-2 self-center',
        className,
      )}
      {...props}
    />
  )
}

export type { AlertTone }
export { Alert, AlertAction, AlertDescription, AlertTitle, alertVariants }
