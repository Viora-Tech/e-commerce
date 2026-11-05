'use client'

import type { AnswerTable } from '@commerce/api'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'

type AnswerChartProps = {
  table: AnswerTable
}

/* recharts is large: it loads only where a chart is drawn. */
const AnswerChartPlot = dynamic(() => import('./answer-chart-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/** The small picture above an answer's table, when the answer has one to draw. */
export default function AnswerChart({ table }: AnswerChartProps) {
  // Early returns
  if (!table.chart || table.rows.length < 2) return null

  return (
    <div className="h-36 w-full">
      <AnswerChartPlot table={table} />
    </div>
  )
}
