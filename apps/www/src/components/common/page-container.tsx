import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type PageContainerProps = { children: ReactNode; className?: string; as?: 'div' | 'section' }

export default function PageContainer({
  children,
  className,
  as: Tag = 'div',
}: PageContainerProps) {
  return <Tag className={cn('mx-auto w-full max-w-page px-4 md:px-8', className)}>{children}</Tag>
}
