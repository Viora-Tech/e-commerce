'use client'

import { ClipboardList, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import DateField from '@/components/fields/date-field'
import DataCard from '@/components/layout/data-card'
import TableEmptyRow from '@/components/table/table-empty-row'
import { shipmentActionsContent, shipmentsContent } from '@/data/shipments'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'
import { pickupRefusal, startingPickupPlan, TIME_24H } from './create-shipment/pickup-plan'

type Unpicked = Awaited<ReturnType<typeof api.shipments.listUnpicked>>
type Pickups = Awaited<ReturnType<typeof api.shipments.listPickups>>
type Manifests = Awaited<ReturnType<typeof api.shipments.listManifests>>

type PickupsTabProps = {
  /** One courier's parcels, pickups and manifests only (a courier app's Pickups page). */
  provider?: string | undefined
}

const copy = shipmentsContent.pickups

/** Keeps the rows of `provider`, or every row when none is given. */
const ofProvider = <T extends { provider: string }>(rows: T[], provider: string | undefined) =>
  provider ? rows.filter((r) => r.provider === provider) : rows

/** Book a pickup for shipments waiting on one, then turn a pickup into a printable manifest. */
export default function PickupsTab({ provider }: PickupsTabProps = {}) {
  // Hooks
  const details = useCopy(shipmentDetailsContent)
  const actions = useCopy(shipmentActionsContent)
  const [unpicked, setUnpicked] = useState<Unpicked>([])
  const [pickups, setPickups] = useState<Pickups>([])
  const [manifests, setManifests] = useState<Manifests>([])
  const [selected, setSelected] = useState<string[]>([])
  // Starts on a day (today, or tomorrow from noon) so ticking parcels is all it takes.
  const [date, setDate] = useState(() => startingPickupPlan().date)
  const [timeFrom, setTimeFrom] = useState('14:00')
  const [timeTo, setTimeTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey has no bearing on the query; bumping it just re-runs this effect
    // after a pickup or manifest action, same idiom as customers-page.tsx.
    if (reloadKey < 0) return
    let cancelled = false
    Promise.all([
      api.shipments.listUnpicked(),
      api.shipments.listPickups(),
      api.shipments.listManifests(),
    ]).then(([allUnpicked, p, m]) => {
      if (cancelled) return
      const u = ofProvider(allUnpicked, provider)
      setUnpicked(u)
      setPickups(ofProvider(p, provider))
      setManifests(ofProvider(m, provider))
      setSelected((prev) => prev.filter((id) => u.some((s) => s.id === id)))
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey, provider])

  // Helpers
  /** Parcels ticked, today or later, and a 24h start time: what the courier needs. */
  const ready = () =>
    selected.length > 0 && date !== '' && date >= todayKey() && TIME_24H.test(timeFrom.trim())

  // Event handlers
  const handleToggle = (id: string, on: boolean) =>
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)))

  const handleSchedule = async () => {
    if (!ready()) return
    setBusy(true)
    try {
      const made = await api.shipments.schedulePickup({
        shipmentIds: selected,
        date,
        timeFrom: timeFrom.trim(),
        timeTo: timeTo.trim() || undefined,
      })
      setReloadKey((k) => k + 1)
      // A refusal comes back as a failed pickup, not an error: say so, in the courier's words.
      const refused = pickupRefusal(made, actions.pickupRefused)
      if (refused) {
        toast.error(refused)
        return
      }
      setSelected([])
      toast.success(actions.pickupDone(selected.length))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleManifest = async (pickupId: string) => {
    setBusy(true)
    try {
      await api.shipments.createManifest({ pickupId })
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DataCard title={copy.heading}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">{copy.help}</p>
          {unpicked.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {unpicked.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`pick-${s.id}`}
                    checked={selected.includes(s.id)}
                    onCheckedChange={(v) => handleToggle(s.id, Boolean(v))}
                  />
                  <FieldLabel
                    htmlFor={`pick-${s.id}`}
                    className="font-mono font-normal text-caption"
                  >
                    {s.waybill}
                  </FieldLabel>
                  <CopyButton value={s.waybill} what={details.awb} visible />
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="pickup-date">{copy.date}</FieldLabel>
              <DateField
                id="pickup-date"
                value={date}
                min={todayKey()}
                onChange={(v) => setDate(v)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pickup-from">{copy.timeFrom}</FieldLabel>
              <Input
                id="pickup-from"
                size="lg"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pickup-to">{copy.timeTo}</FieldLabel>
              <Input
                id="pickup-to"
                size="lg"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
              />
            </Field>
          </div>
          <Button className="w-fit self-end" onClick={handleSchedule} disabled={busy || !ready()}>
            <Truck aria-hidden="true" />
            {busy ? copy.scheduling : copy.submit}
          </Button>
        </div>
      </DataCard>

      <DataCard title={copy.listHeading} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.columns.date}</TableHead>
              <TableHead>{copy.columns.window}</TableHead>
              <TableHead>{copy.columns.packages}</TableHead>
              <TableHead>{copy.columns.status}</TableHead>
              <TableHead>{copy.columns.reference}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickups.length === 0 ? <TableEmptyRow colSpan={6} message={copy.empty} /> : null}
            {pickups.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.scheduledFor}</TableCell>
                <TableCell>
                  {p.timeFrom}
                  {p.timeTo ? `–${p.timeTo}` : ''}
                </TableCell>
                <TableCell>{p.expectedPackageCount}</TableCell>
                <TableCell>
                  <span className="capitalize">{p.status}</span>
                  {p.status === 'failed' && p.error ? (
                    <span className="block max-w-80 text-caption whitespace-normal text-destructive">
                      {p.error}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-caption">{p.providerRef ?? '–'}</TableCell>
                <TableCell className="text-right">
                  {/* A failed request holds no parcels, so there is nothing to manifest. */}
                  {p.status === 'failed' ? null : (
                    <Button variant="outline" size="sm" onClick={() => handleManifest(p.id)}>
                      <ClipboardList aria-hidden="true" />
                      {copy.createManifestFor}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>

      <DataCard title={copy.manifestsHeading} flush>
        <p className="px-4 pt-4 text-caption text-muted-foreground">{copy.manifestHelp}</p>
        <Table>
          <TableBody>
            {manifests.length === 0 ? (
              <TableEmptyRow colSpan={2} message={copy.manifestsEmpty} />
            ) : null}
            {manifests.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="capitalize">{m.provider}</TableCell>
                <TableCell>{m.shipmentIds.length} shipments</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </div>
  )
}
