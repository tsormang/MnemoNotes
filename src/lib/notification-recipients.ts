/** Recipients for note/task reminder jobs. Shift assignments are separate. */
export function collectNonShiftRecipientIds(input: {
  memberUserIds: Array<string | null | undefined>
  personnelProfileIds: Array<string | null | undefined>
  createdBy?: string | null
}): string[] {
  const ids = new Set<string>()
  for (const id of input.memberUserIds) {
    if (id) ids.add(id)
  }
  for (const id of input.personnelProfileIds) {
    if (id) ids.add(id)
  }
  if (input.createdBy) ids.add(input.createdBy)
  return [...ids]
}
