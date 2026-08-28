import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppPermission, CalendarItem } from '../../types/domain'
import { supabase } from '../supabase'
import type { CalendarItemInput, CompanyRoleInput } from '../validation'

export function useCreatePersonnel(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      fullName: string
      companyRoleId: string
      locationId: string
      title?: string
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const { error } = await supabase.from('personnel').insert({
        organization_id: organizationId,
        location_id: values.locationId,
        full_name: values.fullName.trim(),
        title: values.title?.trim() || 'Personnel',
        status: 'active',
        company_role_id: values.companyRoleId,
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
    }: {
      roleId: string
      name?: string
      description?: string
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const updates: Record<string, string> = { updated_at: new Date().toISOString() }
      if (name !== undefined) updates.name = name.trim()
      if (description !== undefined) updates.description = description.trim()

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
      companyRoleId,
      title,
    }: {
      personnelId: string
      companyRoleId?: string
      title?: string
    }) => {
      if (!organizationId || !supabase) {
        throw new Error('Organization is not available.')
      }

      const updates: Record<string, string> = {}
      if (companyRoleId) updates.company_role_id = companyRoleId
      if (title !== undefined) updates.title = title

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
}

function buildCalendarMetadata(values: CalendarItemInput) {
  const metadata: Record<string, unknown> = {}
  if (values.noteCategory?.trim()) {
    metadata.noteCategory = values.noteCategory.trim()
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
        metadata: buildCalendarMetadata(values),
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

      const optimisticItem: CalendarItem = {
        id: values.id ?? `temp-${Date.now()}`,
        kind: values.kind,
        title: values.kind === 'shift' ? '' : values.title.trim(),
        description: calendarItemDescription(values) ?? undefined,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        locationId: values.locationId,
        assignedPersonnelIds: values.assignedPersonnelIds,
        priority: values.priority,
        noteCategory: values.noteCategory,
        notificationOffsets: [],
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
