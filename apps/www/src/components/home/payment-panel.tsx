import { CheckIcon, Loader2Icon as Spinner } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { paymentDemoContent as copy, type PaymentStep } from '@/data/demo-payments'
import BrandLogo from '../common/brand-logo'

type PaymentPanelProps = { step: PaymentStep }

const OTP_DELAY = [
  '[animation-delay:0ms]',
  '[animation-delay:90ms]',
  '[animation-delay:180ms]',
  '[animation-delay:270ms]',
  '[animation-delay:360ms]',
  '[animation-delay:450ms]',
]

// A fixed 7 x 7 pattern that reads as a QR code (demo art, not a real code).
const QR = ['1111101', '1000111', '1011001', '0110110', '1001011', '0111101', '1010111']

const QR_CELLS = QR.flatMap((row, y) =>
  [...row].map((cell, x) => ({ id: `${y}-${x}`, on: cell === '1' })),
)

const OTP_BOXES = copy.otp.digits.map((digit, position) => ({
  id: `otp-${position}`,
  digit,
  delay: OTP_DELAY[position],
}))

function Tick({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <span className="animate-pop-in grid size-12 place-items-center rounded-full bg-foreground text-background">
        <CheckIcon aria-hidden className="size-6" />
      </span>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

/** One step of the demo checkout. Monochrome; only the brand logos turn colour on hover. */
export default function PaymentPanel({ step }: PaymentPanelProps) {
  if (step === 'qr-apps') {
    return (
      <div className="flex items-center gap-5">
        <div
          aria-hidden
          className="grid size-24 shrink-0 grid-cols-7 gap-px rounded-lg bg-white p-2"
        >
          {QR_CELLS.map((cell) => (
            <span
              key={cell.id}
              className={cn('rounded-[1px]', cell.on ? 'bg-black' : 'bg-white')}
            />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">{copy.qr.title}</p>
          <p className="text-xs text-muted-foreground">{copy.qr.body}</p>
          <ul className="flex flex-wrap gap-1.5">
            {copy.qr.apps.map((brand) => (
              <li key={brand} className="group/logo rounded-lg border border-border bg-card">
                <BrandLogo brand={brand} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }
  if (step === 'card-typing') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{copy.card.label}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border-strong bg-card px-4 py-3">
          <span className="animate-type-in block w-[19ch] overflow-hidden font-mono text-base whitespace-nowrap text-foreground">
            {copy.card.number}
          </span>
        </div>
        <ul className="flex gap-1.5">
          {copy.card.networks.map((brand) => (
            <li key={brand} className="group/logo rounded-lg border border-border bg-card">
              <BrandLogo brand={brand} />
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (step === 'otp') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">{copy.otp.title}</p>
        <ol className="flex gap-2">
          {OTP_BOXES.map((box) => (
            <li
              key={box.id}
              className={cn(
                'animate-pop-in grid size-10 place-items-center rounded-lg border border-border-strong bg-card font-mono text-base text-foreground',
                box.delay,
              )}
            >
              {box.digit}
            </li>
          ))}
        </ol>
      </div>
    )
  }
  if (step === 'banks') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">{copy.banks.title}</p>
        <ul className="flex flex-wrap gap-2">
          {copy.banks.options.map((bank) => (
            <li
              key={bank}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium',
                bank === copy.banks.chosen
                  ? 'border-foreground bg-muted text-foreground'
                  : 'border-border text-muted-foreground',
              )}
            >
              {bank}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (step === 'redirect') {
    return (
      <div className="flex items-center gap-4 py-4">
        <Spinner aria-hidden className="size-6 animate-spin text-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">{copy.redirect.title}</p>
          <p className="text-xs text-muted-foreground">{copy.redirect.body}</p>
        </div>
      </div>
    )
  }
  if (step === 'wallets') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">{copy.wallets.title}</p>
        <ul className="grid grid-cols-2 gap-2">
          {copy.wallets.options.map((wallet) => (
            <li
              key={wallet.name}
              className={cn(
                'group/logo flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm',
                wallet.name === copy.wallets.chosen
                  ? 'border-foreground bg-muted'
                  : 'border-border',
              )}
            >
              {wallet.brand ? (
                <BrandLogo brand={wallet.brand} className="px-1" />
              ) : (
                <span className="px-1 py-1 text-sm font-semibold text-foreground opacity-60">
                  {wallet.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (step === 'cod-summary') {
    return (
      <div className="flex flex-col gap-1 py-2">
        <p className="text-lg font-semibold text-foreground">{copy.cod.title}</p>
        <p className="text-sm text-muted-foreground">{copy.cod.body}</p>
      </div>
    )
  }
  if (step === 'whatsapp') {
    return (
      <div className="flex max-w-72 flex-col gap-3 rounded-xl bg-muted p-3.5 text-sm text-foreground">
        <p>{copy.cod.message}</p>
        <div className="flex gap-2">
          <span className="rounded-md border border-foreground bg-background px-2.5 py-1 text-xs font-medium">
            {copy.cod.confirm}
          </span>
          <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium">
            {copy.cod.cancel}
          </span>
        </div>
      </div>
    )
  }
  if (step === 'confirmed') return <Tick title={copy.confirmed.title} body={copy.confirmed.body} />
  return <Tick title={copy.paid.title} body={copy.paid.body} />
}
