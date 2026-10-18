export type FormState = {
  status: 'idle' | 'success' | 'invalid' | 'error'
  errors: Record<string, string>
}

export const FORM_INITIAL: FormState = { status: 'idle', errors: {} }
