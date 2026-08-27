import { z } from 'zod'

export const ownerRegistrationSchema = z.object({
  pharmacyName: z.string().min(2, 'Pharmacy name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  email: z.email('Use a valid email address'),
  password: z.string().min(10, 'Use at least 10 characters'),
})

export const invitePersonnelSchema = z.object({
  email: z.email('Use a valid email address'),
  role: z.enum(['manager', 'personnel', 'viewer']),
  locationId: z.string().min(1, 'Choose a location'),
})

export type OwnerRegistrationInput = z.infer<typeof ownerRegistrationSchema>
export type InvitePersonnelInput = z.infer<typeof invitePersonnelSchema>
