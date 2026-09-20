import React from 'react'
import { cn } from '../../../lib/utils'

interface Props {
  id?: string
  leadingContent?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  rightContent?: React.ReactNode
  className?: string
  textClassName?: string
  children?: React.ReactNode
  variant?: 'default' | 'card'
  variantClassName?: string
  titleClassName?: string
  titleVariant?: 'default' | 'landing'
}
/**
 * Global Component - Header
 *
 * @see {@link Props | props type}
 * @param props.title
 * @param props.description
 * @param props.rightContent
 * @returns
 */

const variants = {
  default: 'flex flex-col gap-5',
  card: 'bg-secondary/40 col-span-1 rounded-xl p-5 flex flex-col gap-5',
}

const titleVariants = {
  default: 'text-2xl text-secondary-foreground',
  landing:
    'text-4xl text-transparent bg-clip-text bg-gradient-to-t from-primary to-muted-foreground leading-tight pb-1',
}

const GlobalLayout = ({
  id,
  leadingContent,
  description,
  title,
  rightContent,
  className,
  textClassName,
  children,
  variant = 'default',
  variantClassName,
  titleClassName,
  titleVariant = 'default',
}: Props) => (
  <div className={cn('w-full', variants[variant], variantClassName)} id={id}>
    <div className={cn('flex w-full flex-wrap items-center justify-between gap-4', className)}>
      <div className="flex flex-col items-start gap-2 overflow-visible">
        {leadingContent ? <div className="self-start">{leadingContent}</div> : null}
        <h3
          className={cn('overflow-visible font-bold', titleVariants[titleVariant], titleClassName)}
          style={{ WebkitBoxDecorationBreak: 'clone' }}
        >
          {title}
        </h3>
        {description && (
          <p className={cn('text-left text-muted-foreground text-sm', textClassName)}>
            {description}
          </p>
        )}
      </div>

      {rightContent && <React.Fragment>{rightContent}</React.Fragment>}
    </div>
    {children && <React.Fragment>{children}</React.Fragment>}
  </div>
)

export default GlobalLayout
