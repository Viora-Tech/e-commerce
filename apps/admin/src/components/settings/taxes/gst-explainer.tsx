import { gstOnPrice } from '@commerce/core/gst'
import { cn } from '@commerce/ui/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { taxesContent } from '@/data/taxes'
import { formatPaise } from '@/lib/money'

type GstExplainerProps = {
  ratePercent: number
  /** Highlights the example that matches the merchant's own setting. */
  inclusive: boolean
  composition: boolean
}

const copy = taxesContent.explainer
const EXAMPLE_PAISE = 100_000

/**
 * "How GST works here": CGST + SGST inside the state, IGST outside it,
 * including vs excluding prices, and a worked ₹1,000 example at the
 * merchant's own default rate (18% if it is 0, so the example still says something).
 */
export default function GstExplainer({ ratePercent, inclusive, composition }: GstExplainerProps) {
  // Render logic
  const rate = ratePercent > 0 ? ratePercent : 18
  const examples = [true, false].map((incl) => {
    const intra = gstOnPrice({
      pricePaise: EXAMPLE_PAISE,
      ratePercent: rate,
      inclusive: incl,
      interState: false,
    })
    return { incl, intra }
  })

  return (
    <Card size="form" id="how-gst-works" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.help}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="flex flex-col gap-3">
          {copy.items.map((item) => (
            <div key={item.title} className="flex flex-col gap-0.5">
              <dt className="text-body font-semibold text-foreground">{item.title}</dt>
              <dd className="text-body text-muted-foreground">{item.body}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-3">
          <p className="text-body font-semibold text-foreground">{copy.exampleHeading(rate)}</p>
          {composition ? (
            <p className="text-caption text-muted-foreground">{copy.composition}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {examples.map(({ incl, intra }) => (
              <div
                key={String(incl)}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border p-4',
                  incl === inclusive && !composition
                    ? 'border-primary bg-primary/5'
                    : 'border-border',
                )}
              >
                <p className="text-body font-medium text-foreground">
                  {incl ? copy.included : copy.excluded}
                </p>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-body tabular-nums">
                  <dt className="text-muted-foreground">{copy.itemValue}</dt>
                  <dd className="text-right text-foreground">{formatPaise(intra.taxablePaise)}</dd>
                  <dt className="text-muted-foreground">{copy.gst}</dt>
                  <dd className="text-right text-foreground">{formatPaise(intra.taxPaise)}</dd>
                  <dt className="font-medium text-foreground">{copy.customerPays}</dt>
                  <dd className="text-right font-semibold text-foreground">
                    {formatPaise(intra.totalPaise)}
                  </dd>
                </dl>
                <p className="text-caption text-muted-foreground">
                  {copy.sameState(formatPaise(intra.cgstPaise), formatPaise(intra.sgstPaise))}
                </p>
                <p className="text-caption text-muted-foreground">
                  {copy.otherState(formatPaise(intra.taxPaise))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
