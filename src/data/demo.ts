import { addHours, formatISO, setHours, startOfToday } from 'date-fns'
import type { CalendarItem, Personnel, PharmacyLocation } from '../types/domain'

const today = startOfToday()

export const pharmacyLocations: PharmacyLocation[] = [
  {
    id: 'central-pharmacy',
    name: 'Central Pharmacy',
    address: 'Main street branch',
    timezone: 'Europe/Athens',
    openingHours: '07:00 - 21:00',
  },
  {
    id: 'north-branch',
    name: 'North Branch',
    address: 'Residential district branch',
    timezone: 'Europe/Athens',
    openingHours: '07:00 - 21:00',
  },
]

export const personnel: Personnel[] = [
  {
    id: 'maria',
    fullName: 'Maria Antoniou',
    companyRoleId: 'demo-owner-role',
    companyRoleName: 'Owner',
    title: 'Pharmacy owner',
    status: 'active',
    skills: ['Responsible pharmacist', 'Stock control'],
    locationId: 'central-pharmacy',
    accountLink: 'linked',
  },
  {
    id: 'nikos',
    fullName: 'Nikos Papadakis',
    companyRoleId: 'demo-pharmacist-role',
    companyRoleName: 'Pharmacist',
    title: 'Pharmacist',
    status: 'active',
    skills: ['Dispensary', 'Patient guidance'],
    locationId: 'central-pharmacy',
    accountLink: 'linked',
  },
  {
    id: 'eleni',
    fullName: 'Eleni Georgiou',
    companyRoleId: 'demo-pharmacist-role',
    companyRoleName: 'Pharmacist',
    title: 'Pharmacy assistant',
    status: 'invited',
    skills: ['Front desk', 'Supplier follow-up'],
    locationId: 'north-branch',
    inviteEmail: 'eleni@example.com',
    accountLink: 'invited',
  },
]

export const calendarItems: CalendarItem[] = [
  {
    id: 'shift-morning',
    kind: 'shift',
    title: 'Morning shift - dispensary',
    description: 'Cover dispensary counter and phone queries.',
    startsAt: formatISO(setHours(today, 8)),
    endsAt: formatISO(setHours(today, 14)),
    locationId: 'central-pharmacy',
    assignedPersonnelIds: ['maria', 'nikos'],
    priority: 'normal',
    notificationOffsets: [-30, 0],
    requiresAcknowledgement: false,
  },
  {
    id: 'note-stock',
    kind: 'note',
    title: 'Check supplier backorder list',
    description: 'Follow up with MedSupply on pending insulin orders.',
    startsAt: formatISO(setHours(today, 11)),
    endsAt: formatISO(addHours(setHours(today, 11), 1)),
    locationId: 'central-pharmacy',
    assignedPersonnelIds: ['maria'],
    priority: 'high',
    noteCategory: 'Stock',
    notificationOffsets: [-15, 30],
    requiresAcknowledgement: true,
  },
  {
    id: 'task-closing',
    kind: 'task',
    title: 'Closing checklist and handover',
    startsAt: formatISO(setHours(today, 21)),
    endsAt: formatISO(setHours(today, 22)),
    locationId: 'north-branch',
    assignedPersonnelIds: ['eleni'],
    priority: 'critical',
    noteCategory: 'Handover',
    notificationOffsets: [-30, 0, 15],
    requiresAcknowledgement: true,
  },
]
