/**
 * Browser-safe permission surface. Client components import this subpath
 * (`@commerce/core/permissions`) so they never pull the database into the bundle.
 */

export {
  isSystemRoleSlug,
  roleSlug,
  SYSTEM_ROLE_SLUGS,
  SYSTEM_ROLES,
  type SystemRole,
  type SystemRoleSlug,
} from './roles'
export {
  type Action,
  ALL_PERMISSIONS,
  isPermission,
  type Permission,
  permission,
  permissions,
  RESOURCE_METADATA,
  type Resource,
  sanitisePermissions,
  statement,
} from './statement'
