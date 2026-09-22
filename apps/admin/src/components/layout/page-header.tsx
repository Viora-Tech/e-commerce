import { cn } from '@commerce/ui/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@commerce/ui/shadcn/breadcrumb'
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

export type Crumb = { label: string; href?: string }

type PageHeaderProps = {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  /** Right-aligned buttons; primary action last. */
  actions?: ReactNode
  /** `frame` draws the Dealport 22/700 heading (5:2375); default is the density scale. */
  size?: 'compact' | 'frame'
}

/** Title row every admin page starts with. */
export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  size = 'compact',
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((c, i) => (
              <Fragment key={`${c.label}-${c.href ?? i}`}>
                {i > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {c.href ? (
                    <BreadcrumbLink render={<Link href={c.href} />}>{c.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className={cn(
              'truncate text-ink-strong normal-case',
              size === 'frame' ? 'text-kit-heading' : 'text-page-title',
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                'mt-1 text-muted-foreground',
                size === 'frame' ? 'text-kit-body' : 'text-caption',
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
