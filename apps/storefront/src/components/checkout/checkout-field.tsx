type CheckoutFieldProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  pattern?: string
  autoComplete?: string
  readOnly?: boolean
}

/** Label plus input in the Glide field markup; the state select uses the same classes inline. */
export default function CheckoutField({
  label,
  type = 'text',
  required,
  pattern,
  autoComplete,
  value,
  onChange,
  onBlur,
  readOnly,
}: CheckoutFieldProps) {
  return (
    <label className="field">
      <span className="field__label text-small">{label}</span>
      <input
        className="field__input"
        type={type}
        required={required}
        pattern={pattern}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={readOnly}
      />
    </label>
  )
}
