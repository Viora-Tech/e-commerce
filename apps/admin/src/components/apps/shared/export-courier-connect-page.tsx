'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ExportCourierConnectPage, ExportCourierCopy
 * WHAT:  the Connect page of an export courier (DHL Express, FedEx, ShipGlobal): the 3-step
 *        guide, the Test/Live switch (a saved `mode` field), key and account fields, origin PIN
 *        and city, IEC, and the "pickup with each booking" switch. A courier without a sandbox
 *        or a pickup call (ShipGlobal) turns those two off and may add its own fields.
 * WHY:   both apps ask for the same things under different key names, so one page with the
 *        field keys passed in instead of two near-identical copies.
 * WHERE: components/apps/{dhl-express,fedex,shipglobal}/connect-page.tsx.
 */

import { Truck } from '@commerce/ui/icons'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import ConnectFields, { type ConnectFieldSpec } from '@/components/apps/shared/connect-fields'
import type { ModeSwitch } from '@/components/apps/shared/connect-mode-switch'
import CourierConnectAside from '@/components/apps/shared/courier-connect-aside'
import CourierConnectGuide, {
  type CourierGuideCopy,
} from '@/components/apps/shared/courier-connect-guide'
import ProviderConnectPage, {
  type ConnectContext,
  type TestOutcome,
} from '@/components/apps/shared/provider-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { courierConnectContent } from '@/data/courier-apps'

type FieldCopy = { label: string; help: string }

export type ExportCourierCopy = CourierGuideCopy & {
  title: string
  intro: string
  testConnection: string
  testing: string
  testHint: string
  rateLimited: string
  mode?: ModeSwitch['copy'] | undefined
  pickup?: { label: string; help: string } | undefined
  fields: Record<string, FieldCopy>
}

type ExportCourierConnectPageProps = {
  providerId: string
  copy: ExportCourierCopy
  /** The courier's own names for its key and secret fields, in form order. */
  keyField: string
  secretField: string
  /** The account box's key: a numeric account number unless the courier names another. */
  accountField?: string | undefined
  /** The courier's own boxes after the IEC (ShipGlobal: IOSS number, service). */
  extraFields?: ((ctx: ConnectContext<TestOutcome>) => ConnectFieldSpec[]) | undefined
  /** Extra saved values the extra boxes start from. */
  extraValues?: FieldValues | undefined
  test: (values: FieldValues) => Promise<TestOutcome>
}

type Ctx = ConnectContext<TestOutcome>

const ORIGIN_FIELDS = ['originPincode', 'originCity', 'iec'] as const

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

/** The key, secret, account and origin boxes, in form order. */
function fieldSpecs(
  copy: ExportCourierCopy,
  keyField: string,
  secretField: string,
  accountField: string,
): ConnectFieldSpec[] {
  const field = (key: string): FieldCopy => copy.fields[key] ?? { label: key, help: '' }
  return [
    { key: keyField, ...field(keyField) },
    { key: secretField, type: 'password', ...field(secretField) },
    {
      key: accountField,
      ...field(accountField),
      ...(accountField === 'accountNumber' ? { inputMode: 'numeric' as const } : {}),
    },
    ...ORIGIN_FIELDS.map((key) => ({
      key,
      ...field(key),
      ...(key === 'originPincode' ? { inputMode: 'numeric' as const, pincode: true } : {}),
    })),
  ]
}

const emptyValuesFor = (
  keyField: string,
  secretField: string,
  accountField: string,
  copy: ExportCourierCopy,
): FieldValues => ({
  [keyField]: '',
  [secretField]: '',
  [accountField]: '',
  originPincode: '',
  originCity: '',
  iec: '',
  ...(copy.mode ? { mode: 'test' } : {}),
  ...(copy.pickup ? { bookPickup: 'true' } : {}),
})

const modeSwitch = (modeCopy: ModeSwitch['copy']): ModeSwitch => ({
  read: (values) => (values.mode === 'live' ? 'live' : 'test'),
  write: (next, setField) => setField('mode', next),
  copy: modeCopy,
})

export default function ExportCourierConnectPage({
  providerId,
  copy,
  keyField,
  secretField,
  accountField = 'accountNumber',
  extraFields,
  extraValues,
  test,
}: ExportCourierConnectPageProps) {
  // Helpers
  const renderGuide = ({ values, opened, onOpen }: Ctx) => {
    const step2Done = filled(values[keyField]) && filled(values[secretField])
    return (
      <CourierConnectGuide
        copy={copy}
        openedDashboard={opened}
        onOpenDashboard={onOpen}
        step2Done={step2Done}
        step3Done={
          step2Done &&
          filled(values[accountField]) &&
          filled(values.originCity) &&
          /^\d{6}$/.test((values.originPincode ?? '').trim())
        }
      />
    )
  }
  const renderFields = (ctx: Ctx) => (
    <ConnectFields
      providerId={providerId}
      specs={[
        ...fieldSpecs(copy, keyField, secretField, accountField),
        ...(extraFields?.(ctx) ?? []),
      ]}
      values={ctx.values}
      onField={ctx.setField}
    />
  )
  const renderExtras = ({ values, setField }: Ctx) =>
    copy.pickup ? (
      <Field orientation="horizontal" className="justify-between">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${providerId}-bookPickup`} className="font-normal">
            {copy.pickup.label}
          </FieldLabel>
          <FieldDescription>{copy.pickup.help}</FieldDescription>
        </div>
        <Switch
          id={`${providerId}-bookPickup`}
          checked={values.bookPickup !== 'false'}
          onCheckedChange={(v) => setField('bookPickup', v ? 'true' : 'false')}
        />
      </Field>
    ) : null
  const renderAside = (ctx: Ctx) => (
    <CourierConnectAside
      providerId={providerId}
      ctx={ctx}
      pickupKey="originCity"
      mode={copy.mode ? modeSwitch(copy.mode) : undefined}
    />
  )

  // Render logic
  const mode = copy.mode ? modeSwitch(copy.mode) : undefined

  return (
    <ProviderConnectPage
      providerId={providerId}
      kind="shipping"
      icon={<Truck aria-hidden="true" />}
      copy={{ ...copy, ...courierConnectContent }}
      emptyValues={{
        ...emptyValuesFor(keyField, secretField, accountField, copy),
        ...extraValues,
      }}
      test={test}
      waitForListing
      keepTestOn={copy.pickup ? ['bookPickup'] : []}
      mode={mode}
      guide={renderGuide}
      fields={renderFields}
      extras={renderExtras}
      aside={renderAside}
    />
  )
}
