'use client'

import { cn } from '@commerce/ui/lib/utils'
import dynamic from 'next/dynamic'
import type { ChartPoint } from './chart-config'
import ChartLoading from './chart-loading'

type MiniBarsProps = { data: ChartPoint[]; className?: string }

/* recharts is large: it loads only where a chart is drawn. */
const MiniBarsPlot = dynamic(() => import('./mini-bars-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/** 5:1620 "bargraph": 35px strip of 8px green bars, 3px apart, no axes. */
export default function MiniBars({ data, className }: MiniBarsProps) {
  return (
    <div className={cn('h-8 w-full', className)}>
      <MiniBarsPlot data={data} />
    </div>
  )
}
