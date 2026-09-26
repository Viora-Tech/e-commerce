import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { gatewayGuides, paymentsSetupContent as setupCopy } from '@/data/payments-setup'
import CopyField from './copy-field'

type RazorpayWebhookFieldsProps = {
  url: string
  secret: string
  onNewSecret: () => void
}

const guide = gatewayGuides.razorpay
const copy = setupCopy.connect

/** Masked secrets come back as ••••1234; sending one back means "keep the saved value". */
const isMasked = (v: string) => v.startsWith('••••')

/** Step 3 for pasted Razorpay keys: the webhook address and secret to paste into Razorpay. */
export default function RazorpayWebhookFields({
  url,
  secret,
  onNewSecret,
}: RazorpayWebhookFieldsProps) {
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
    </FieldGroup>
  )
}
