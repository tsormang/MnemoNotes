import { z } from 'zod'
import { clockToMinutes, isClockTime } from './calendar-hours'

const clockTimeSchema = z
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
  title: z.string().optional(),
})

export const createPersonnelSchema = z.object({
  companyRoleId: z.uuid('Choose a company role'),
  fullName: z.string().min(2, 'Full name is required'),
  title: z.string().optional(),
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
})

export const updatePersonnelSchema = z.object({
  companyRoleId: z.uuid('Choose a company role'),
  title: z.string().optional(),
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
    requiresAcknowledgement: z.boolean(),
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
    start: clockTimeSchema,
    end: clockTimeSchema,
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
export type UpdatePersonnelInput = z.infer<typeof updatePersonnelSchema>
export type CalendarItemInput = z.infer<typeof calendarItemSchema>
export type WorkingDayInput = z.infer<typeof workingDaySchema>
