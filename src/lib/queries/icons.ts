import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase } from '../supabase'
import {
  FALLBACK_APP_ICONS,
  buildIconLookup,
  iconsForEntityType,
  resolveIconPath,
} from '../icons/fallback-catalog'
import type { AppIcon, AvatarGender, IconEntityType } from '../icons/types'
import { defaultIconIdForEntityType } from '../icons/defaults'

export const appIconsQueryKey = ['app-icons'] as const

function mapAppIconRow(row: {
  id: string
  label: string
  path: string
  entity_types: IconEntityType[]
  tags: string[] | null
  sort_order: number
  avatar_gender: AvatarGender | null
}): AppIcon {
  return {
    id: row.id,
    label: row.label,
    path: row.path,
    entityTypes: row.entity_types,
    tags: row.tags ?? [],
    sortOrder: row.sort_order,
    avatarGender: row.avatar_gender,
  }
}

async function fetchAppIcons(): Promise<AppIcon[]> {
  if (!supabase) return FALLBACK_APP_ICONS

  const { data, error } = await supabase
    .from('app_icons')
    .select('id, label, path, entity_types, tags, sort_order, avatar_gender')
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapAppIconRow)
}

export function useAppIcons() {
  return useQuery({
    queryKey: appIconsQueryKey,
    queryFn: fetchAppIcons,
    staleTime: Number.POSITIVE_INFINITY,
    initialData: FALLBACK_APP_ICONS,
    enabled: isSupabaseConfigured ? undefined : false,
  })
}

export function useIconCatalog() {
  const query = useAppIcons()
  const icons = query.data ?? FALLBACK_APP_ICONS

  const byId = useMemo(() => buildIconLookup(icons), [icons])

  return {
    icons,
    byId,
    isLoading: query.isLoading,
    resolvePath: (
      iconId: string | null | undefined,
      entityType: IconEntityType,
      avatarGender?: AvatarGender,
    ) => resolveIconPath(byId, iconId, entityType, avatarGender),
    iconsFor: (entityType: IconEntityType, avatarGender?: AvatarGender) =>
      iconsForEntityType(icons, entityType, avatarGender),
    defaultIconId: (entityType: IconEntityType, avatarGender?: AvatarGender) =>
      defaultIconIdForEntityType(entityType, avatarGender),
    iconMatchesGender: (iconId: string | null | undefined, avatarGender: AvatarGender) =>
      byId.get(iconId ?? '')?.avatarGender === avatarGender,
  }
}
