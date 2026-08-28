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
  locationName: z.string().min(1, 'Location name is required'),
})

export const inviteOwnerSchema = z.object({
  organizationId: z.uuid('Choose a company'),
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerEmail: z.email('Use a valid email address'),
})

export const invitePersonnelSchema = z.object({
  email: z.email('Use a valid email address'),
  companyRoleId: z.uuid('Choose a company role'),
  locationId: z.uuid('Choose a location'),
  fullName: z.string().min(2, 'Full name is required'),
  title: z.string().optional(),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z.string().min(10, 'Use at least 10 characters'),
  fullName: z.string().min(2).optional(),
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
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type WorkingDayInput = z.infer<typeof workingDaySchema>
