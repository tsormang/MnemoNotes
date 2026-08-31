import clsx from 'clsx'
import { useIconCatalog } from '../../lib/queries/icons'
import { shouldUsePersonnelInitials, personnelInitials } from '../../lib/icons/fallback-catalog'
import type { IconAvatarSize, IconEntityType } from '../../lib/icons/types'

const sizeClass: Record<IconAvatarSize, string> = {
  sm: 'entity-avatar--sm',
  md: 'entity-avatar--md',
  lg: 'entity-avatar--lg',
  xl: 'entity-avatar--xl',
}

export interface IconAvatarProps {
  iconId?: string | null
  entityType: IconEntityType
  label?: string
  size?: IconAvatarSize
  className?: string
  /** Personnel with default icon show initials instead of the generic placeholder. */
  initialsFallback?: boolean
}

export function IconAvatar({
  iconId,
  entityType,
  label,
  size = 'sm',
  className,
  initialsFallback = entityType === 'personnel',
}: IconAvatarProps) {
  const { resolvePath } = useIconCatalog()
  const showInitials =
    initialsFallback && label && shouldUsePersonnelInitials(iconId) && entityType === 'personnel'

  if (showInitials) {
    return (
      <span
        className={clsx('entity-avatar', 'entity-avatar--initials', sizeClass[size], className)}
        aria-hidden="true"
      >
        {personnelInitials(label)}
      </span>
    )
  }

  const path = resolvePath(iconId, entityType)

  return (
    <span className={clsx('entity-avatar', sizeClass[size], className)} aria-hidden="true">
      {path ? <img src={path} alt="" /> : null}
    </span>
  )
}
