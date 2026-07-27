import type { FieldError, UseFormRegister } from 'react-hook-form'

export type FormValues = Record<string, any>

const NUMBER_REGISTER_OPTIONS = {
  setValueAs: (value: unknown) => value === '' ? '' : Number(value),
}

interface FieldProps {
  label: string
  name: string
  register: UseFormRegister<FormValues>
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number
  error?: FieldError
  placeholder?: string
  disabled?: boolean
}

export function Field({ label, name, register, type = 'text', error, ...rest }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        autoComplete="off"
        {...rest}
        {...register(name, type === 'number' ? NUMBER_REGISTER_OPTIONS : undefined)}
        aria-invalid={!!error}
      />
      {error ? <small className="field-error">{error.message}</small> : null}
    </label>
  )
}

interface SelectFieldProps extends Omit<FieldProps, 'type'> {
  options: Array<{ value: string; label: string }>
}

export function SelectField({ label, name, register, options, error, disabled }: SelectFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...register(name)} disabled={disabled} aria-invalid={!!error}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {error ? <small className="field-error">{error.message}</small> : null}
    </label>
  )
}

export const AREA_OPTIONS = [
  { value: 'transfer', label: 'transfer · 中转区' },
  { value: 'platform', label: 'platform · 测试平台' },
  { value: 'test_area', label: 'test_area · 磁体测试区' },
]

export const PLATE_AREA_OPTIONS = AREA_OPTIONS.slice(0, 2)
