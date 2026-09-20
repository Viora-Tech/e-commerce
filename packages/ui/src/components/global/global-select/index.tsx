'use client'

import { cn } from '../../../lib/utils'
import { Label } from '../../shadcn/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../../shadcn/select'

type SelectOption = {
  value: string
  label: string
}

interface GlobalSelectProps {
  /** Label displayed above the select */
  label?: string
  /** Group label displayed inside the dropdown */
  groupLabel?: string
  name?: string
  options: SelectOption[]
  placeholder?: string
  value?: string
  defaultValue?: string
  onValueChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  error?: string | null
  helperText?: string
  showLabel?: boolean
  className?: string
  wrapperClassName?: string
  labelClassName?: string
  selectContentClassName?: string
}

const GlobalSelect = ({
  label,
  groupLabel,
  name,
  options,
  placeholder = 'Select an option',
  value,
  defaultValue,
  onValueChange,
  required = false,
  disabled = false,
  error,
  helperText,
  showLabel = true,
  className,
  wrapperClassName,
  labelClassName,
  selectContentClassName,
}: GlobalSelectProps) => (
  <div className={cn('space-y-2', wrapperClassName)}>
    {showLabel && label && (
      <Label className={cn('font-medium text-foreground text-sm', labelClassName)} htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
    )}
    <Select
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={onValueChange}
      value={value}
    >
      <SelectTrigger
        className={cn(
          'h-9 w-full rounded-xl bg-secondary transition-colors hover:bg-secondary/80',
          error && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
        id={name}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn('max-h-[280px] bg-background', selectContentClassName)}>
        <SelectGroup>
          {groupLabel && <SelectLabel>{groupLabel}</SelectLabel>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
    {error && (
      <p className="text-destructive text-xs" id={name ? `${name}-error` : undefined}>
        {error}
      </p>
    )}
    {helperText && !error && (
      <p className="text-muted-foreground text-xs" id={name ? `${name}-helper` : undefined}>
        {helperText}
      </p>
    )}
  </div>
)

export default GlobalSelect
