import type { AdminFilterNode } from '@/components/global/admin-filter-popover'

export const extractEnumFilter = <T extends string = string>(
  nodes: AdminFilterNode[],
  fieldKey: string,
): T | null => {
  for (const node of nodes) {
    if (
      node.kind === 'rule' &&
      node.fieldKey === fieldKey &&
      node.operatorKey === 'is' &&
      node.value
    ) {
      return node.value as T
    }
    if (node.kind === 'group') {
      for (const rule of node.rules) {
        if (rule.fieldKey === fieldKey && rule.operatorKey === 'is' && rule.value) {
          return rule.value as T
        }
      }
    }
  }
  return null
}
