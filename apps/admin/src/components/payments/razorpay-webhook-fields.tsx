import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import CopyButton from '@/components/fields/copy-button'
import { gatewayGuides, paymentsSetupContent } from '@/data/payments-setup'
import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { useCopy } from '@/hooks/use-copy'
import CopyField from './copy-field'
import RazorpayWebsiteList from './razorpay-website-list'

type RazorpayWebhookFieldsProps = {
  url: string
  secret: string
  /** The events to tick in Razorpay's webhook form. */
  events: string[]
  /** The store's web addresses, to list under "Website and app details" in Razorpay. */
  websites: string[]
  onNewSecret: () => void
}

/** Masked secrets come back as ••••1234; sending one back means "keep the saved value". */
const isMasked = (v: string) => v.startsWith('••••')

/** Step 3 for pasted Razorpay keys: the webhook address and secret to paste into Razorpay. */
export default function RazorpayWebhookFields({
  url,
  secret,
  events,
  websites,
  onNewSecret,
}: RazorpayWebhookFieldsProps) {
  // Hooks
  const { razorpay: guide } = useCopy(gatewayGuides)
  const { connect: copy } = useCopy(paymentsSetupContent)
  const { list: sitesCopy } = useCopy(razorpayWebsitesContent)

  // Render logic
  const saved = isMasked(secret)

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="razorpay-webhook-url">{guide.fields.webhookUrl?.label}</FieldLabel>
        <CopyField id="razorpay-webhook-url" value={url} />
        <FieldDescription>{guide.fields.webhookUrl?.help}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="razorpay-webhook-secret">
          {guide.fields.webhookSecret?.label}
        </FieldLabel>
        {saved ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="razorpay-webhook-secret"
              size="lg"
              readOnly
              value={secret}
              className="max-w-60"
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="gap-1.5"
              onClick={onNewSecret}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {copy.newSecret}
            </Button>
          </div>
        ) : (
          <CopyField id="razorpay-webhook-secret" value={secret} />
        )}
        <FieldDescription>
          {saved ? copy.savedSecret : guide.fields.webhookSecret?.help}
        </FieldDescription>
      </Field>
      <Field>
        <div className="flex items-center gap-1">
          <FieldLabel id="razorpay-webhook-events">{guide.fields.webhookEvents?.label}</FieldLabel>
          <CopyButton
            value={events.join(', ')}
            what={guide.fields.webhookEvents?.label ?? ''}
            visible
          />
        </div>
        <ul aria-labelledby="razorpay-webhook-events" className="flex flex-wrap gap-1.5">
          {events.map((e) => (
            <li
              key={e}
              className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-caption text-foreground"
            >
              {e}
            </li>
          ))}
        </ul>
        <FieldDescription>{guide.fields.webhookEvents?.help}</FieldDescription>
      </Field>
      <Field id="razorpay-websites">
        <FieldLabel id="razorpay-websites-label">{sitesCopy.label}</FieldLabel>
        <RazorpayWebsiteList websites={websites} labelledBy="razorpay-websites-label" />
        <FieldDescription>{sitesCopy.help}</FieldDescription>
      </Field>
    </FieldGroup>
  )
}
