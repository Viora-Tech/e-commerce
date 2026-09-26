import { paymentsSetupContent as setupCopy } from '@/data/payments-setup'
import UpiCompare from './upi-compare'

const copy = setupCopy.upiOptions

/** The two UPI options that live in Advanced, named in plain words with a comparison. */
export default function UpiOptions() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-body font-medium text-foreground">{copy.heading}</p>
        <UpiCompare />
      </div>
      <ul className="flex flex-col gap-1.5">
        {[copy.auto, copy.manual].map((o) => (
          <li key={o.name} className="flex flex-col">
            <span className="text-body text-foreground">{o.name}</span>
            <span className="text-caption text-muted-foreground">{o.help}</span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-muted-foreground">{copy.offNote}</p>
    </div>
  )
}
