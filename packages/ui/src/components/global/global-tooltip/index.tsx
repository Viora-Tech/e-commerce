import type React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../shadcn/tooltip'

interface Props {
  trigger: React.ReactNode
  content: string
  direction?: 'top' | 'bottom' | 'left' | 'right'
}

const GlobalTooltip = ({ content, trigger, direction }: Props) => (
  <Tooltip>
    <TooltipTrigger asChild>{trigger}</TooltipTrigger>
    <TooltipContent side={direction}>
      <p className="line-clamp-1">{content}</p>
    </TooltipContent>
  </Tooltip>
)

export default GlobalTooltip
