'use client'

import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseVersion,
} from '@commerce/core/expenses'
import { parseRupees } from '@commerce/money'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import FormDialog from '@/components/layout/form-dialog'
import { monthlyExpensesContent } from '@/data/monthly-expenses'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ExpenseDialogProps = {
  /** The version being changed; null adds a new expense. */
  expense: ExpenseVersion | null
  /** This month, `2026-10`: where a new expense or a change starts. */
  month: string
  onClose: () => void
  onSaved: () => void
}

/** Add a monthly expense, or change one from a chosen month on (earlier months keep theirs). */
export default function ExpenseDialog({ expense, month, onClose, onSaved }: ExpenseDialogProps) {
  // Hooks
  const copy = useCopy(monthlyExpensesContent)
  const [name, setName] = useState(expense?.name ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'other')
  const [amount, setAmount] = useState(expense ? String(expense.amountPaise / 100) : '')
  const [startsOn, setStartsOn] = useState(
    expense ? (expense.startsOn > month ? expense.startsOn : month) : month,
  )
  const [repeats, setRepeats] = useState(expense ? expense.endsOn !== expense.startsOn : true)
  const [endsOn, setEndsOn] = useState(expense?.endsOn ?? '')

  // Event handlers
  const handleSubmit = async () => {
    const amountPaise = parseRupees(amount)
    if (!name.trim()) {
      toast.error(copy.invalidName)
      return
    }
    if (amountPaise === null) {
      toast.error(copy.invalidAmount)
      return
    }
    const last = repeats ? endsOn || null : startsOn
    try {
      if (expense) {
        await api.monthlyExpenses.update({
          id: expense.id,
          name,
          category,
          amountPaise,
          fromMonth: startsOn,
          endsOn: last,
        })
      } else {
        await api.monthlyExpenses.create({ name, category, amountPaise, startsOn, endsOn: last })
      }
      toast.success(copy.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const d = copy.dialog

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={expense ? d.editTitle : d.addTitle}
      description={expense ? d.editHelp : undefined}
      submitLabel={expense ? d.save : d.add}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="expense-name">{d.name}</FieldLabel>
          <Input
            id="expense-name"
            placeholder={d.namePlaceholder}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="expense-category">{d.category}</FieldLabel>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
            <SelectTrigger id="expense-category" className="w-full">
              <SelectValue>{copy.categories[category]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {copy.categories[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="expense-amount">{d.amount}</FieldLabel>
            <Input
              id="expense-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="expense-starts">{expense ? d.fromMonth : d.startsOn}</FieldLabel>
            <DateField
              mode="month"
              id="expense-starts"
              value={startsOn}
              onChange={(v) => setStartsOn(v)}
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Switch id="expense-repeats" checked={repeats} onCheckedChange={setRepeats} />
          <FieldLabel htmlFor="expense-repeats">{d.repeats}</FieldLabel>
        </Field>
        {repeats ? (
          <Field>
            <FieldLabel htmlFor="expense-ends">{d.endsOn}</FieldLabel>
            <DateField
              mode="month"
              id="expense-ends"
              value={endsOn}
              min={startsOn}
              onChange={(v) => setEndsOn(v)}
            />
            <FieldDescription>{d.endsOnHelp}</FieldDescription>
          </Field>
        ) : null}
      </div>
    </FormDialog>
  )
}
