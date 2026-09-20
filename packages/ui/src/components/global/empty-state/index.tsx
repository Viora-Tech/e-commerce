'use client'
import { cn } from '../../../lib/utils'
import { Button } from '../../shadcn/button'
import { Card, CardContent } from '../../shadcn/card'
import IconComponent from '../icon-component'

interface EmptyStateProps {
  state?: 'EMPTY' | 'ERROR'
  icon?: string
  iconType?: 'lucide' | 'custom'
  iconSize?: string
  /** When false, omits the icon and uses compact padding (e.g. inside split panels) */
  showIcon?: boolean
  title?: string
  description?: string
  descriptionClassName?: string
  className?: string
  cardClassName?: string
  action?: {
    label: React.ReactNode
    onClick: () => void
    icon?: string
    disabled?: boolean
  }
}

const EmptyState = ({
  state = 'EMPTY',
  icon,
  iconType,
  iconSize,
  showIcon,
  title,
  description,
  descriptionClassName,
  className,
  cardClassName,
  action,
}: EmptyStateProps) => {
  if (!title || !description) {
    return null
  }

  if (showIcon === true && !icon) {
    return null
  }
  if (showIcon !== false && showIcon !== true && !icon) {
    return null
  }

  const isCompact = showIcon === false

  const ariaLabel = `${title}. ${description}`
  const isError = state === 'ERROR'

  return (
    <div
      aria-atomic="true"
      aria-label={ariaLabel}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn('flex w-full flex-col items-center justify-center', className)}
      role={isError ? 'alert' : 'status'}
    >
      <Card
        className={cn(
          'flex h-full min-h-0 w-full flex-col border-2',
          isError ? 'border-destructive/20 bg-destructive/10' : 'border-dashed bg-secondary/30',
          cardClassName,
        )}
      >
        <CardContent
          className={cn(
            'flex w-full flex-1 flex-col items-center justify-center text-center',
            isCompact ? 'px-4 py-5' : 'pt-8 pb-8',
          )}
        >
          <div
            className={cn(
              'flex flex-col items-center justify-center',
              isCompact ? 'gap-2' : 'gap-4',
            )}
          >
            {!isCompact && icon ? (
              <div aria-hidden="true" className="flex items-center justify-center">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full p-4',
                    isError ? 'bg-destructive/10' : 'bg-secondary',
                  )}
                >
                  <IconComponent
                    className={cn(
                      iconSize || 'h-10 w-10',
                      isError ? 'text-destructive' : 'text-muted-foreground',
                    )}
                    icon={icon}
                    iconType={iconType}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col items-center space-y-2">
              <h3
                className={cn(
                  'text-center font-semibold',
                  isCompact ? 'text-sm' : 'text-xl',
                  isError && 'text-destructive',
                )}
              >
                {title}
              </h3>
              <p
                className={cn(
                  'max-w-md text-center text-muted-foreground text-sm leading-relaxed',
                  isCompact && 'text-balance',
                  descriptionClassName,
                )}
              >
                {description}
              </p>
            </div>

            {action && (
              <Button
                className="mt-4"
                disabled={action.disabled}
                onClick={action.onClick}
                size="default"
                variant={isError ? 'destructive' : 'default'}
              >
                {action.icon && (
                  <IconComponent className="h-4 w-4" icon={action.icon} iconType="lucide" />
                )}
                {action.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default EmptyState
