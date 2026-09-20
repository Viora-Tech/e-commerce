/** Resolves a Lucide icon by its export name, e.g. icon="ChevronLeft". */
import * as Lucide from 'lucide-react'
import type React from 'react'

type Props = Omit<React.SVGProps<SVGSVGElement>, 'fill'> & {
  icon: string
  /** Kept for callers ported from CodeHelp; only Lucide icons exist here. */
  iconType?: 'lucide' | 'custom' | string
  className?: string
}

type LucideComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

export default function IconComponent({ icon, className, iconType: _iconType, ...rest }: Props) {
  const Cmp = (Lucide as unknown as Record<string, LucideComponent | undefined>)[icon]
  if (!Cmp) return null
  return <Cmp className={className} {...rest} />
}
