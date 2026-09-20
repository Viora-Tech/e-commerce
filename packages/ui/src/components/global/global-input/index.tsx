import type React from 'react'
import { cn } from '../../../lib/utils'
import { Input } from '../../shadcn/input'
import { Label } from '../../shadcn/label'

interface GlobalInputProps {
  label?: string
  name: string
  type?: 'text' | 'email' | 'tel' | 'date' | 'datetime-local' | 'password' | 'number' | 'url'
  value?: string
  defaultValue?: string
  placeholder?: string
  className?: string
  wrapperClassName?: string
  labelClassName?: string
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  step?: string
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  error?: string | null
  helperText?: string
  showLabel?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

const GlobalInput = ({
  label,
  name,
  type = 'text',
  value,
  defaultValue,
  placeholder,
  className,
  wrapperClassName,
  labelClassName,
  required = false,
  disabled = false,
  min,
  max,
  step,
  inputMode,
  error,
  helperText,
  showLabel = true,
  onChange,
  onKeyDown,
}: GlobalInputProps) => (
  <div className={cn('space-y-2', wrapperClassName)}>
    {showLabel && label && (
      <Label className={cn('font-medium text-foreground text-sm', labelClassName)} htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
    )}
    <Input
      aria-describedby={error ? `${name}-error` : helperText ? `${name}-helper` : undefined}
      aria-invalid={error ? 'true' : 'false'}
      aria-label={label}
      className={cn(
        'h-9 rounded-xl',
        error && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      defaultValue={defaultValue}
      disabled={disabled}
      id={name}
      inputMode={inputMode}
      max={max}
      min={min}
      name={name}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      required={required}
      step={step}
      type={type}
      value={value}
    />
    {error && (
      <p className="text-destructive text-xs" id={`${name}-error`}>
        {error}
      </p>
    )}
    {helperText && !error && (
      <p className="text-muted-foreground text-xs" id={`${name}-helper`}>
        {helperText}
      </p>
    )}
  </div>
)

export default GlobalInput
