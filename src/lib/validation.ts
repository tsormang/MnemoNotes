import type { TFunction } from 'i18next'
import { z } from 'zod'
import {
  isCompleteWeekDay,
  isPartialWeekDay,
  resolveWeekShiftRange,
} from './calendar-week-schedule'
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

export function createForgotPasswordSchema(t: TFunction<'validation'>) {
  return z.object({
    email: z.email(t('emailInvalid')),
  })
}

export function createResetPasswordSchema(t: TFunction<'validation'>) {
  return z
    .object({
      password: z.string().min(10, t('passwordMinLength')),
      confirmPassword: z.string().min(1, t('passwordRequired')),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: t('passwordMismatch'),
      path: ['confirmPassword'],
    })
}

export function createAcceptInviteSchema(t: TFunction<'validation'>) {
  return z.object({
    token: z.string().min(1, t('tokenRequired')),
    password: z.string().min(10, t('passwordMinLength')),
    fullName: z.string().min(2).optional(),
  })
}

export function createOwnerRegistrationSchema(t: TFunction<'validation'>) {
  return z
    .object({
      email: z.email(t('emailInvalid')),
      fullName: z.string().min(2, t('fullNameRequired')),
      companyName: z.string().min(2, t('companyNameRequired')),
      password: z.string().min(10, t('passwordMinLength')),
      confirmPassword: z.string().min(1, t('passwordRequired')),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: t('passwordMismatch'),
      path: ['confirmPassword'],
    })
}

export function createReviewRegistrationSchema(t: TFunction<'validation'>) {
  return z.object({
    companyName: z.string().min(2, t('companyNameRequired')),
    fullName: z.string().min(2, t('fullNameRequired')),
    timezone: z.string().min(1, t('timezoneRequired')),
    reviewNote: z.string().max(500).optional(),
  })
}

const entityColorKeySchema = z.enum([
  'blue',
  'green',
  'purple',
  'orange',
  'teal',
  'pink',
  'olive',
  'indigo',
])

export function createCreatePersonnelSchema(t: TFunction<'validation'>) {
  return z.object({
    companyRoleId: z.uuid(t('chooseRole')),
    fullName: z.string().min(2, t('fullNameRequired')),
    iconId: z.string().min(1).optional(),
    avatarGender: z.enum(['male', 'female']),
    colorKey: z.union([entityColorKeySchema, z.literal('')]).optional(),
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
    colorKey: entityColorKeySchema,
  })
}

export function createCompanyRoleSchema(t: TFunction<'validation'>) {
  return z.object({
    name: z.string().min(2, t('roleNameRequired')).max(60),
    description: z.string().max(200).optional(),
    iconId: z.string().min(1).optional(),
    colorKey: z.union([entityColorKeySchema, z.literal('')]).optional(),
  })
}

export function createEditCompanyRoleProfileSchema(t: TFunction<'validation'>) {
  return z.object({
    name: z.string().min(2, t('roleNameRequired')).max(60),
    iconId: z.string().min(1),
    colorKey: entityColorKeySchema,
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
      allDay: z.boolean(),
      startsAt: z.string().min(1, t('startRequired')),
      endsAt: z.string().min(1, t('endRequired')),
      locationId: z.uuid(t('locationRequired')),
      assignedPersonnelIds: z.array(z.uuid()),
      priority: z.enum(['low', 'normal', 'high', 'critical']),
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
      if (value.kind === 'shift' && value.allDay) {
        ctx.addIssue({
          code: 'custom',
          message: t('shiftNotAllDay'),
          path: ['allDay'],
        })
      }

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
  colorKey: z.union([entityColorKeySchema, z.literal('')]).optional(),
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
  colorKey: z.union([entityColorKeySchema, z.literal('')]).optional(),
})

export const editPersonnelProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(120),
  iconId: z.string().min(1),
  avatarGender: z.enum(['male', 'female']),
  colorKey: entityColorKeySchema,
})

export const editCompanyRoleProfileSchema = z.object({
  name: z.string().min(2, 'Role name is required').max(60),
  iconId: z.string().min(1),
  colorKey: entityColorKeySchema,
})

export const updatePersonnelSchema = z.object({
  companyRoleId: z.uuid('Choose a company role'),
  title: z.string().optional(),
  iconId: z.string().min(1).optional(),
  avatarGender: z.enum(['male', 'female']).optional(),
  colorKey: entityColorKeySchema.optional(),
})

export const calendarItemSchema = z
  .object({
    title: z.string().max(120),
    description: z.string().max(2000).optional(),
    kind: z.enum(['shift', 'note', 'task']),
    allDay: z.boolean(),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
    locationId: z.uuid('Choose a location'),
    assignedPersonnelIds: z.array(z.uuid()),
    priority: z.enum(['low', 'normal', 'high', 'critical']),
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
    if (value.kind === 'shift' && value.allDay) {
      ctx.addIssue({
        code: 'custom',
        message: 'Shifts must have a start time',
        path: ['allDay'],
      })
    }

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

export const weekScheduleDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string(),
  endTime: z.string(),
})

export const weekScheduleSchema = z
  .object({
    assignedPersonnelId: z.uuid('Choose a person'),
    overnight: z.boolean(),
    days: z.array(weekScheduleDaySchema).length(7),
  })
  .superRefine((value, ctx) => {
    let filled = 0

    value.days.forEach((day, index) => {
      if (isPartialWeekDay(day)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Start and end time are both required',
          path: ['days', index, day.startTime ? 'endTime' : 'startTime'],
        })
        return
      }

      if (!isCompleteWeekDay(day)) return

      const range = resolveWeekShiftRange(day.date, day.startTime, day.endTime, value.overnight)
      if (!range) {
        ctx.addIssue({
          code: 'custom',
          message: value.overnight
            ? 'End time must be after start time'
            : 'End time must be after start time, or turn on Overnight',
          path: ['days', index, 'endTime'],
        })
        return
      }

      filled += 1
    })

    if (filled === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add start and end times for at least one day',
        path: ['days'],
      })
    }
  })

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<ReturnType<typeof createForgotPasswordSchema>>
export type ResetPasswordInput = z.infer<ReturnType<typeof createResetPasswordSchema>>
export type OwnerRegistrationInput = z.infer<ReturnType<typeof createOwnerRegistrationSchema>>
export type ReviewRegistrationInput = z.infer<ReturnType<typeof createReviewRegistrationSchema>>
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
export type WeekScheduleInput = z.infer<typeof weekScheduleSchema>
