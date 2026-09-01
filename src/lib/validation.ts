import type { TFunction } from 'i18next'
import { z } from 'zod'
import { clockToMinutes, isClockTime } from './calendar-hours'

function clockTimeSchema(t: TFunction<'validation'>) {
  return z
    .string()
    .refine((value) => isClockTime(value) && value !== '24:00', t('clockFormat'))
}

export function createLoginSchema(t: TFunction<'validation'>) {
  return z.object({
    email: z.email(t('emailInvalid')),
    password: z.string().min(1, t('passwordRequired')),
  })
}

export function createAcceptInviteSchema(t: TFunction<'validation'>) {
  return z.object({
    token: z.string().min(1, t('tokenRequired')),
    password: z.string().min(10, t('passwordMinLength')),
    fullName: z.string().min(2).optional(),
  })
}

export function createCreatePersonnelSchema(t: TFunction<'validation'>) {
  return z.object({
    companyRoleId: z.uuid(t('chooseRole')),
    fullName: z.string().min(2, t('fullNameRequired')),
    iconId: z.string().min(1).optional(),
    avatarGender: z.enum(['male', 'female']),
  })
}

export function createLinkPersonnelInviteSchema(t: TFunction<'validation'>) {
  return z.object({
    personnelId: z.uuid(t('personnelRequired')),
    email: z.email(t('emailInvalid')),
  })
}

export function createEditPersonnelProfileSchema(t: TFunction<'validation'>) {
  return z.object({
    fullName: z.string().min(2, t('fullNameRequired')).max(120),
    iconId: z.string().min(1),
    avatarGender: z.enum(['male', 'female']),
  })
}

export function createCompanyRoleSchema(t: TFunction<'validation'>) {
  return z.object({
    name: z.string().min(2, t('roleNameRequired')).max(60),
    description: z.string().max(200).optional(),
    iconId: z.string().min(1).optional(),
  })
}

export function createEditCompanyRoleProfileSchema(t: TFunction<'validation'>) {
  return z.object({
    name: z.string().min(2, t('roleNameRequired')).max(60),
    iconId: z.string().min(1),
  })
}

export function createWorkingDaySchema(t: TFunction<'validation'>) {
  return z
    .object({
      start: clockTimeSchema(t),
      end: clockTimeSchema(t),
    })
    .refine((value) => clockToMinutes(value.start) < clockToMinutes(value.end), {
      message: t('endAfterStart'),
      path: ['end'],
    })
}

export function createCalendarItemSchema(t: TFunction<'validation'>) {
  return z
    .object({
      title: z.string().max(120),
      description: z.string().max(2000).optional(),
      kind: z.enum(['shift', 'note', 'task']),
      startsAt: z.string().min(1, t('startRequired')),
      endsAt: z.string().min(1, t('endRequired')),
      locationId: z.uuid(t('locationRequired')),
      assignedPersonnelIds: z.array(z.uuid()),
      priority: z.enum(['low', 'normal', 'high', 'critical']),
      noteCategory: z.string().max(60).optional(),
      iconId: z.string().max(60).optional(),
      requiresAcknowledgement: z.boolean(),
      notificationOffsets: z.array(z.number().int()),
      useCustomNotificationOffsets: z.boolean(),
    })
    .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
      message: t('endAfterStart'),
      path: ['endsAt'],
    })
    .superRefine((value, ctx) => {
      if (value.kind !== 'shift' && !value.title.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: t('titleRequired'),
          path: ['title'],
        })
      }
    })
}

const defaultClockTimeSchema = z
  .string()
  .refine((value) => isClockTime(value) && value !== '24:00', 'Use 24-hour time (HH:mm)')

export const loginSchema = z.object({
  email: z.email('Use a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const provisionCompanySchema = z.object({
  organizationName: z.string().min(2, 'Company name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerEmail: z.email('Use a valid email address'),
  ownerPassword: z.union([z.literal(''), z.string().min(10, 'Use at least 10 characters')]).optional(),
})

export const inviteOwnerSchema = z.object({
  organizationId: z.uuid('Choose a company'),
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerEmail: z.email('Use a valid email address'),
})

export const invitePersonnelSchema = z.object({
  email: z.email('Use a valid email address'),
  companyRoleId: z.uuid('Choose a company role'),
  fullName: z.string().min(2, 'Full name is required'),
})

export const createPersonnelSchema = z.object({
  companyRoleId: z.uuid('Choose a company role'),
  fullName: z.string().min(2, 'Full name is required'),
  iconId: z.string().min(1).optional(),
  avatarGender: z.enum(['male', 'female']),
})

export const linkPersonnelInviteSchema = z.object({
  personnelId: z.uuid('Personnel is required'),
  email: z.email('Use a valid email address'),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z.string().min(10, 'Use at least 10 characters'),
  fullName: z.string().min(2).optional(),
})

export const companyRoleSchema = z.object({
  name: z.string().min(2, 'Role name is required').max(60),
  description: z.string().max(200).optional(),
  iconId: z.string().min(1).optional(),
})

export const editPersonnelProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(120),
  iconId: z.string().min(1),
  avatarGender: z.enum(['male', 'female']),
})

export const editCompanyRoleProfileSchema = z.object({
  name: z.string().min(2, 'Role name is required').max(60),
  iconId: z.string().min(1),
})

export const updatePersonnelSchema = z.object({
  companyRoleId: z.uuid('Choose a company role'),
  title: z.string().optional(),
  iconId: z.string().min(1).optional(),
  avatarGender: z.enum(['male', 'female']).optional(),
})

export const calendarItemSchema = z
  .object({
    title: z.string().max(120),
    description: z.string().max(2000).optional(),
    kind: z.enum(['shift', 'note', 'task']),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
    locationId: z.uuid('Choose a location'),
    assignedPersonnelIds: z.array(z.uuid()),
    priority: z.enum(['low', 'normal', 'high', 'critical']),
    noteCategory: z.string().max(60).optional(),
    iconId: z.string().max(60).optional(),
    requiresAcknowledgement: z.boolean(),
    notificationOffsets: z.array(z.number().int()),
    useCustomNotificationOffsets: z.boolean(),
  })
  .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: 'End time must be after start time',
    path: ['endsAt'],
  })
  .superRefine((value, ctx) => {
    if (value.kind !== 'shift' && !value.title.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Title is required',
        path: ['title'],
      })
    }
  })

export const workingDaySchema = z
  .object({
    start: defaultClockTimeSchema,
    end: defaultClockTimeSchema,
  })
  .refine((value) => clockToMinutes(value.start) < clockToMinutes(value.end), {
    message: 'End time must be after start time',
    path: ['end'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type ProvisionCompanyInput = z.infer<typeof provisionCompanySchema>
export type InviteOwnerInput = z.infer<typeof inviteOwnerSchema>
export type InvitePersonnelInput = z.infer<typeof invitePersonnelSchema>
export type CreatePersonnelInput = z.infer<typeof createPersonnelSchema>
export type LinkPersonnelInviteInput = z.infer<typeof linkPersonnelInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type CompanyRoleInput = z.infer<typeof companyRoleSchema>
export type EditPersonnelProfileInput = z.infer<typeof editPersonnelProfileSchema>
export type EditCompanyRoleProfileInput = z.infer<typeof editCompanyRoleProfileSchema>
export type UpdatePersonnelInput = z.infer<typeof updatePersonnelSchema>
export type CalendarItemInput = z.infer<typeof calendarItemSchema>
export type WorkingDayInput = z.infer<typeof workingDaySchema>
