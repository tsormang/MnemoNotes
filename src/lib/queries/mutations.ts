import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppPermission, CalendarItem } from '../../types/domain'
import {
  buildDuplicateTargets,
  getSeriesSiblings,
  type CalendarSeriesViewContext,
  type SeriesDuplicateMode,
} from '../calendar-series'
import {
  buildScheduleCopyTargets,
  getScheduleClearItemIds,
  type ScheduleAction,
  type ScheduleCopyTarget,
} from '../calendar-schedule-copy'
import { filterCopyTargetsByKeys, type CopyTargetLike } from '../calendar-copy-overwrite'
import { resolveNotificationOffsets } from '../notification-schedule'
import { invokeEdgeFunction } from '../edge-functions'
import { supabase } from '../supabase'
import { DEFAULT_ROLE_ICON_ID } from '../icons/role-icons.generated'
import type { CalendarItemInput, CompanyRoleInput } from '../validation'
import type { NotificationDefaults } from '../../types/domain'

export function useCreatePersonnel(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      fullName: string
      companyRoleId: string
      locationId: string
      iconId?: string
      avatarGender?: 'male' | 'female'
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { error } = await supabase.from('personnel').insert({
        organization_id: organizationId,
        location_id: values.locationId,
        full_name: values.fullName.trim(),
        title: '',
        status: 'active',
        company_role_id: values.companyRoleId,
        icon_id: values.iconId ?? (values.avatarGender === 'male' ? 'avatar-male-001' : 'avatar-female-002'),
        avatar_gender: values.avatarGender ?? 'female',
      })

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['personnel', organizationId] })
    },
  })
}

export function useCreateCompanyRole(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CompanyRoleInput) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { data, error } = await supabase
        .from('company_roles')
        .insert({
          organization_id: organizationId,
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
          icon_id: values.iconId ?? DEFAULT_ROLE_ICON_ID,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company-roles', organizationId] })
    },
  })
}

export function useUpdateCompanyRole(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      roleId,
      name,
      description,
      iconId,
    }: {
      roleId: string
      name?: string
      description?: string
      iconId?: string
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const updates: Record<string, string> = { updated_at: new Date().toISOString() }
      if (name !== undefined) updates.name = name.trim()
      if (description !== undefined) updates.description = description.trim()
      if (iconId !== undefined) updates.icon_id = iconId

      const { error } = await supabase
        .from('company_roles')
        .update(updates)
        .eq('id', roleId)
        .eq('organization_id', organizationId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company-roles', organizationId] })
      await queryClient.invalidateQueries({ queryKey: ['personnel', organizationId] })
    },
  })
}

export function useDeleteCompanyRole(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (roleId: string) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { error } = await supabase
        .from('company_roles')
        .delete()
        .eq('id', roleId)
        .eq('organization_id', organizationId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company-roles', organizationId] })
      await queryClient.invalidateQueries({ queryKey: ['personnel', organizationId] })
    },
  })
}

export function useToggleRolePermission(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      roleId,
      permission,
      enabled,
    }: {
      roleId: string
      permission: AppPermission
      enabled: boolean
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      if (enabled) {
        const { error } = await supabase
          .from('company_role_permissions')
          .insert({ company_role_id: roleId, permission })

        if (error) throw error
        return
      }

      const { error } = await supabase
        .from('company_role_permissions')
        .delete()
        .eq('company_role_id', roleId)
        .eq('permission', permission)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company-roles', organizationId] })
    },
  })
}

export function useUpdatePersonnel(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      personnelId,
      fullName,
      companyRoleId,
      title,
      iconId,
      avatarGender,
    }: {
      personnelId: string
      fullName?: string
      companyRoleId?: string
      title?: string
      iconId?: string
      avatarGender?: 'male' | 'female'
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const updates: Record<string, string> = {}
      if (fullName !== undefined) updates.full_name = fullName.trim()
      if (companyRoleId) updates.company_role_id = companyRoleId
      if (title !== undefined) updates.title = title
      if (iconId !== undefined) updates.icon_id = iconId
      if (avatarGender !== undefined) updates.avatar_gender = avatarGender

      const { error } = await supabase
        .from('personnel')
        .update(updates)
        .eq('id', personnelId)
        .eq('organization_id', organizationId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['personnel', organizationId] })
    },
  })
}

type CalendarItemMutationInput = CalendarItemInput & {
  id?: string
  timezone?: string
  seriesId?: string
  orgNotificationDefaults?: NotificationDefaults | null
}

function buildCalendarMetadata(
  values: CalendarItemInput,
  orgDefaults?: NotificationDefaults | null,
  seriesId?: string,
) {
  const notificationOffsets = resolveNotificationOffsets({
    kind: values.kind,
    requiresAcknowledgement: values.requiresAcknowledgement,
    customOffsets: values.notificationOffsets,
    useCustomNotificationOffsets: values.useCustomNotificationOffsets,
    orgDefaults,
    allDay: values.allDay,
  })

  const metadata: Record<string, unknown> = {
    notificationOffsets,
  }
  if (values.allDay) {
    metadata.allDay = true
  }
  if (values.iconId?.trim()) {
    metadata.iconId = values.iconId.trim()
  }
  if (seriesId) {
    metadata.seriesId = seriesId
  }
  return metadata
}

function calendarItemDescription(values: CalendarItemInput): string | null {
  if (values.kind === 'task') return null
  const trimmed = values.description?.trim() ?? ''
  return trimmed || null
}

async function syncShiftAssignments(
  organizationId: string,
  calendarItemId: string,
  personnelIds: string[],
  userId: string | undefined,
) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error: deleteError } = await supabase
    .from('shift_assignments')
    .delete()
    .eq('calendar_item_id', calendarItemId)

  if (deleteError) throw deleteError

  if (personnelIds.length === 0) return

  const { error: insertError } = await supabase.from('shift_assignments').insert(
    personnelIds.map((personnelId) => ({
      organization_id: organizationId,
      calendar_item_id: calendarItemId,
      personnel_id: personnelId,
      assigned_by: userId ?? null,
    })),
  )

  if (insertError) throw insertError
}

export function useUpsertCalendarItem(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['calendar-items', organizationId]

  return useMutation({
    mutationFn: async (values: CalendarItemMutationInput) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const row = {
        organization_id: organizationId,
        location_id: values.locationId,
        kind: values.kind,
        title: values.kind === 'shift' ? '' : values.title.trim(),
        description: calendarItemDescription(values),
        starts_at: values.startsAt,
        ends_at: values.endsAt,
        timezone: values.timezone ?? 'Europe/Athens',
        priority: values.priority,
        requires_acknowledgement: values.requiresAcknowledgement,
        metadata: buildCalendarMetadata(values, values.orgNotificationDefaults, values.seriesId),
        updated_at: new Date().toISOString(),
      }

      if (values.id) {
        const { error } = await supabase.from('calendar_items').update(row).eq('id', values.id)
        if (error) throw error
        await syncShiftAssignments(
          organizationId,
          values.id,
          values.kind === 'shift' ? values.assignedPersonnelIds : [],
          userId ?? undefined,
        )
        return values.id
      }

      const { data, error } = await supabase
        .from('calendar_items')
        .insert({ ...row, created_by: userId })
        .select('id')
        .single()

      if (error) throw error

      if (values.kind === 'shift' && values.assignedPersonnelIds.length > 0) {
        await syncShiftAssignments(
          organizationId,
          data.id,
          values.assignedPersonnelIds,
          userId ?? undefined,
        )
      }

      return data.id
    },
    onMutate: async (values) => {
      if (!organizationId) return

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CalendarItem[]>(queryKey)

      const resolvedOffsets = resolveNotificationOffsets({
        kind: values.kind,
        requiresAcknowledgement: values.requiresAcknowledgement,
        customOffsets: values.notificationOffsets,
        useCustomNotificationOffsets: values.useCustomNotificationOffsets,
        orgDefaults: values.orgNotificationDefaults,
        allDay: values.allDay,
      })

      const optimisticItem: CalendarItem = {
        id: values.id ?? `temp-${Date.now()}`,
        kind: values.kind,
        title: values.kind === 'shift' ? '' : values.title.trim(),
        description: calendarItemDescription(values) ?? undefined,
        allDay: values.allDay || undefined,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        locationId: values.locationId,
        assignedPersonnelIds: values.assignedPersonnelIds,
        priority: values.priority,
        iconId: values.iconId,
        seriesId: values.seriesId,
        notificationOffsets: resolvedOffsets,
        requiresAcknowledgement: values.requiresAcknowledgement,
      }

      queryClient.setQueryData<CalendarItem[]>(queryKey, (current = []) => {
        if (values.id) {
          return current.map((item) => (item.id === values.id ? optimisticItem : item))
        }
        return [...current, optimisticItem]
      })

      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
      void invokeEdgeFunction('schedule-notifications', {}).catch(() => undefined)
    },
  })
}

async function fetchItemMetadata(
  organizationId: string,
  itemId: string,
): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('calendar_items')
    .select('metadata')
    .eq('id', itemId)
    .eq('organization_id', organizationId)
    .single()

  if (error) throw error
  return (data.metadata ?? {}) as Record<string, unknown>
}

async function setItemSeriesId(organizationId: string, itemId: string, seriesId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const metadata = await fetchItemMetadata(organizationId, itemId)
  const { error } = await supabase
    .from('calendar_items')
    .update({
      metadata: { ...metadata, seriesId },
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('organization_id', organizationId)

  if (error) throw error
}

function cloneInputFromItem(
  item: CalendarItem,
  startsAt: string,
  endsAt: string,
  seriesId: string | undefined,
  timezone?: string,
): CalendarItemMutationInput {
  return {
    kind: item.kind,
    title: item.title,
    description: item.description,
    allDay: Boolean(item.allDay),
    startsAt,
    endsAt,
    locationId: item.locationId,
    assignedPersonnelIds: item.assignedPersonnelIds,
    priority: item.priority,
    iconId: item.iconId ?? '',
    requiresAcknowledgement: item.requiresAcknowledgement,
    notificationOffsets: item.notificationOffsets,
    useCustomNotificationOffsets: true,
    seriesId,
    timezone,
  }
}

async function insertCalendarItemClone(
  organizationId: string,
  userId: string | null,
  values: CalendarItemMutationInput,
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const row = {
    organization_id: organizationId,
    location_id: values.locationId,
    kind: values.kind,
    title: values.kind === 'shift' ? '' : values.title.trim(),
    description: calendarItemDescription(values),
    starts_at: values.startsAt,
    ends_at: values.endsAt,
    timezone: values.timezone ?? 'Europe/Athens',
    priority: values.priority,
    requires_acknowledgement: values.requiresAcknowledgement,
    metadata: buildCalendarMetadata(values, values.orgNotificationDefaults, values.seriesId),
    created_by: userId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('calendar_items').insert(row).select('id').single()
  if (error) throw error

  if (values.kind === 'shift' && values.assignedPersonnelIds.length > 0) {
    await syncShiftAssignments(
      organizationId,
      data.id,
      values.assignedPersonnelIds,
      userId ?? undefined,
    )
  }

  return data.id
}

async function deleteCalendarItemsByIds(organizationId: string, ids: string[]) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (ids.length === 0) return

  const { error } = await supabase
    .from('calendar_items')
    .delete()
    .in('id', ids)
    .eq('organization_id', organizationId)

  if (error) throw error
}

export type CalendarSeriesAction =
  | { type: 'duplicate'; mode: SeriesDuplicateMode }
  | { type: 'delete' }
  | { type: 'delete-series-except' }

export function useCalendarSeriesActions(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['calendar-items', organizationId]

  return useMutation({
    mutationFn: async ({
      action,
      item,
      viewContext,
      timezone,
      allItems,
      overwriteItemIds = [],
      skipConflictedTargetKeys = [],
    }: {
      action: CalendarSeriesAction
      item: CalendarItem
      viewContext: CalendarSeriesViewContext
      timezone?: string
      allItems: CalendarItem[]
      overwriteItemIds?: string[]
      skipConflictedTargetKeys?: string[]
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      if (action.type === 'delete') {
        const { error } = await supabase
          .from('calendar_items')
          .delete()
          .eq('id', item.id)
          .eq('organization_id', organizationId)

        if (error) throw error
        return { created: 0, deleted: 1 }
      }

      if (action.type === 'delete-series-except') {
        if (!item.seriesId) {
          throw new Error('This event is not part of a series.')
        }

        const siblings = getSeriesSiblings(allItems, item)
        const idsToDelete = siblings.filter((entry) => entry.id !== item.id).map((entry) => entry.id)
        if (idsToDelete.length === 0) {
          throw new Error('No other instances to delete.')
        }

        const { error } = await supabase
          .from('calendar_items')
          .delete()
          .in('id', idsToDelete)
          .eq('organization_id', organizationId)

        if (error) throw error
        return { created: 0, deleted: idsToDelete.length }
      }

      const targets = buildDuplicateTargets(item, action.mode, viewContext)
      if (targets.length === 0) {
        throw new Error('No new copies to create — target days may be empty or fall on Sunday.')
      }

      const copyTargets: CopyTargetLike[] = targets.map((target) => ({
        ...target,
        sourceItem: item,
      }))
      const targetsToInsert = filterCopyTargetsByKeys(copyTargets, skipConflictedTargetKeys)
      if (targetsToInsert.length === 0) {
        throw new Error('No copies to create after skipping overlapping events.')
      }

      await deleteCalendarItemsByIds(organizationId, overwriteItemIds)

      const seriesId = item.seriesId ?? crypto.randomUUID()
      if (!item.seriesId) {
        await setItemSeriesId(organizationId, item.id, seriesId)
      }

      for (const target of targetsToInsert) {
        await insertCalendarItemClone(
          organizationId,
          userId,
          cloneInputFromItem(item, target.startsAt, target.endsAt, seriesId, timezone),
        )
      }

      return { created: targetsToInsert.length, deleted: overwriteItemIds.length }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useCalendarScheduleActions(organizationId: string | null, userId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['calendar-items', organizationId]

  return useMutation({
    mutationFn: async ({
      action,
      viewContext,
      timezone,
      allItems,
      canCreateItem,
      canDeleteItem,
      overwriteItemIds = [],
      skipConflictedTargetKeys = [],
    }: {
      action: ScheduleAction
      viewContext: CalendarSeriesViewContext
      timezone?: string
      allItems: CalendarItem[]
      canCreateItem: (item: CalendarItem) => boolean
      canDeleteItem: (item: CalendarItem) => boolean
      overwriteItemIds?: string[]
      skipConflictedTargetKeys?: string[]
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      if (action.type === 'clear') {
        const ids = getScheduleClearItemIds(allItems, action.scope, viewContext).filter((id) => {
          const item = allItems.find((entry) => entry.id === id)
          return item ? canDeleteItem(item) : false
        })

        if (ids.length === 0) {
          throw new Error('No events to clear in this range.')
        }

        const { error } = await supabase
          .from('calendar_items')
          .delete()
          .in('id', ids)
          .eq('organization_id', organizationId)

        if (error) throw error
        return { created: 0, deleted: ids.length }
      }

      const eligibleItems = allItems.filter(canCreateItem)
      const targets = buildScheduleCopyTargets(eligibleItems, action.copy, viewContext)
      if (targets.length === 0) {
        throw new Error('No new copies to create — the range may be empty or targets fall on Sunday.')
      }

      const targetsToInsert = filterCopyTargetsByKeys(
        targets as CopyTargetLike[],
        skipConflictedTargetKeys,
      )
      if (targetsToInsert.length === 0) {
        throw new Error('No copies to create after skipping overlapping events.')
      }

      const deletableOverwriteIds = overwriteItemIds.filter((id) => {
        const item = allItems.find((entry) => entry.id === id)
        return item ? canDeleteItem(item) : false
      })
      await deleteCalendarItemsByIds(organizationId, deletableOverwriteIds)

      for (const target of targetsToInsert as ScheduleCopyTarget[]) {
        await insertCalendarItemClone(
          organizationId,
          userId,
          cloneInputFromItem(
            target.sourceItem,
            target.startsAt,
            target.endsAt,
            undefined,
            timezone,
          ),
        )
      }

      return { created: targetsToInsert.length, deleted: deletableOverwriteIds.length }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useUpdateCalendarItemTimes(organizationId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['calendar-items', organizationId]

  return useMutation({
    mutationFn: async ({
      id,
      startsAt,
      endsAt,
    }: {
      id: string
      startsAt: string
      endsAt: string
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { error } = await supabase
        .from('calendar_items')
        .update({
          starts_at: startsAt,
          ends_at: endsAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (error) throw error
    },
    onMutate: async ({ id, startsAt, endsAt }) => {
      if (!organizationId) return

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CalendarItem[]>(queryKey)

      queryClient.setQueryData<CalendarItem[]>(queryKey, (current = []) =>
        current.map((item) => (item.id === id ? { ...item, startsAt, endsAt } : item)),
      )

      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useDeleteCalendarItem(organizationId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['calendar-items', organizationId]

  return useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { error } = await supabase
        .from('calendar_items')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (error) throw error
    },
    onMutate: async (id) => {
      if (!organizationId) return

      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CalendarItem[]>(queryKey)

      queryClient.setQueryData<CalendarItem[]>(queryKey, (current = []) =>
        current.filter((item) => item.id !== id),
      )

      return { previous }
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}
