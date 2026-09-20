'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

type DatePickerProps = {
  value?: Date | null
  onChange?: (date: Date | null) => void
  showTime?: boolean
  placeholder?: string
  disabled?: boolean
}

function DatePicker({
  value,
  onChange,
  showTime = false,
  placeholder = 'Pick a date',
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.(null)
      return
    }
    if (showTime && value) {
      date.setHours(value.getHours(), value.getMinutes())
    }
    onChange?.(date)
    if (!showTime) {
      setOpen(false)
    }
  }

  const handleTimeChange = (type: 'hours' | 'minutes', val: string) => {
    const num = parseInt(val, 10)
    if (Number.isNaN(num)) return
    const next = value ? new Date(value) : new Date()
    if (type === 'hours') {
      next.setHours(Math.min(23, Math.max(0, num)))
    } else {
      next.setMinutes(Math.min(59, Math.max(0, num)))
    }
    onChange?.(next)
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
          )}
          disabled={disabled}
          variant="outline"
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, showTime ? 'PPP p' : 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" onSelect={handleSelect} selected={value ?? undefined} />
        {showTime && (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <span className="text-sm text-muted-foreground">Time:</span>
            <input
              className="h-8 w-14 rounded-md border border-input bg-background px-2 text-center text-sm"
              max={23}
              min={0}
              onChange={(e) => handleTimeChange('hours', e.target.value)}
              type="number"
              value={value ? String(value.getHours()).padStart(2, '0') : '00'}
            />
            <span className="text-sm text-muted-foreground">:</span>
            <input
              className="h-8 w-14 rounded-md border border-input bg-background px-2 text-center text-sm"
              max={59}
              min={0}
              onChange={(e) => handleTimeChange('minutes', e.target.value)}
              type="number"
              value={value ? String(value.getMinutes()).padStart(2, '0') : '00'}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, type DatePickerProps }
