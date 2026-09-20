/** Admin filter field defs for the products list, in the CodeHelp shape. */
import type { AdminTableFilterField } from '@/components/global/admin-filter-popover'
import type { ProductListItem } from './types'

const TEXT_OPERATORS = [
  { key: 'includes', label: 'Includes' },
  { key: 'doesNotInclude', label: 'Does Not Include' },
  { key: 'equals', label: 'Equals' },
] as const

const ENUM_OPERATORS = [
  { key: 'is', label: 'Is' },
  { key: 'isNot', label: 'Is Not' },
] as const

export const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
] as const

export const PRODUCT_FILTER_FIELDS: readonly AdminTableFilterField<ProductListItem>[] = [
  {
    getValue: (p) => p.title,
    icon: 'FileText',
    key: 'title',
    label: 'Title',
    operators: TEXT_OPERATORS,
    placeholder: 'Enter Value',
    type: 'text',
  },
  {
    getValue: (p) => p.vendor ?? '',
    icon: 'Tag',
    key: 'vendor',
    label: 'Brand',
    operators: TEXT_OPERATORS,
    placeholder: 'Enter Value',
    type: 'text',
  },
  {
    getValue: (p) => p.productType ?? '',
    icon: 'Boxes',
    key: 'productType',
    label: 'Type',
    operators: TEXT_OPERATORS,
    placeholder: 'Enter Value',
    type: 'text',
  },
  {
    getValue: (p) => p.status,
    icon: 'Circle',
    key: 'status',
    label: 'Status',
    operators: ENUM_OPERATORS,
    placeholder: 'Select Status',
    type: 'enum',
    valueOptions: STATUS_OPTIONS,
  },
] as const
