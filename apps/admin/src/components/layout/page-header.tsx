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
}

/** Title row every admin page starts with. */
export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
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
          <h1 className="truncate text-page-title text-ink-strong normal-case">{title}</h1>
          {subtitle ? <p className="mt-1 text-caption text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
