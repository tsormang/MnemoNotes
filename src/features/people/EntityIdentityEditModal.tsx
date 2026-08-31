import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import {
  AvatarSelectField,
  syncPersonnelIconForGender,
} from '../../components/icons/IconPicker'
import { useIconCatalog } from '../../lib/queries/icons'
import type { AvatarGender } from '../../lib/icons/types'
import {
  createEditCompanyRoleProfileSchema,
  createEditPersonnelProfileSchema,
  type EditCompanyRoleProfileInput,
  type EditPersonnelProfileInput,
} from '../../lib/validation'

type PersonnelEditModalProps = {
  open: boolean
  onClose: () => void
  title: string
  initialFullName: string
  initialIconId: string
  initialAvatarGender: AvatarGender
  onSubmit: (values: EditPersonnelProfileInput) => Promise<void>
  isPending?: boolean
  error?: string | null
}

type CompanyRoleEditModalProps = {
  open: boolean
  onClose: () => void
  title: string
  initialName: string
  initialIconId: string
  onSubmit: (values: EditCompanyRoleProfileInput) => Promise<void>
  isPending?: boolean
  error?: string | null
}

function EditModalActions({
  onClose,
  isPending,
}: {
  onClose: () => void
  isPending?: boolean
}) {
  const { t } = useTranslation(['people', 'common'])

  return (
    <div className="modal-actions">
      <button className="icon-ghost people-panel__cancel" type="button" onClick={onClose}>
        {t('people:editModal.cancel')}
      </button>
      <button className="icon-button" type="submit" disabled={isPending}>
        {t('people:editModal.saveChanges')}
      </button>
    </div>
  )
}

export function PersonnelIdentityEditModal({
  open,
  onClose,
  title,
  initialFullName,
  initialIconId,
  initialAvatarGender,
  onSubmit,
  isPending = false,
  error = null,
}: PersonnelEditModalProps) {
  const { t } = useTranslation(['people', 'common', 'validation'])
  const { t: tv } = useTranslation('validation')
  const { iconMatchesGender } = useIconCatalog()
  const editPersonnelProfileSchema = useMemo(() => createEditPersonnelProfileSchema(tv), [tv])
  const form = useForm<EditPersonnelProfileInput>({
    resolver: zodResolver(editPersonnelProfileSchema),
    defaultValues: {
      fullName: initialFullName,
      iconId: initialIconId,
      avatarGender: initialAvatarGender,
    },
  })

  const watchedAvatarGender = form.watch('avatarGender')
  const watchedIconId = form.watch('iconId')

  useEffect(() => {
    if (!open) return
    form.reset({
      fullName: initialFullName,
      iconId: initialIconId,
      avatarGender: initialAvatarGender,
    })
  }, [form, initialAvatarGender, initialFullName, initialIconId, open])

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className="create-event-form entity-edit-form" onSubmit={handleSubmit}>
        <label>
          {t('common:field.fullName')}
          <input type="text" autoFocus {...form.register('fullName')} />
        </label>
        <AvatarSelectField
          entityType="personnel"
          value={watchedIconId}
          avatarGender={watchedAvatarGender}
          onChange={(iconId) => form.setValue('iconId', iconId, { shouldDirty: true })}
          onAvatarGenderChange={(avatarGender) => {
            form.setValue('avatarGender', avatarGender, { shouldDirty: true })
            form.setValue(
              'iconId',
              syncPersonnelIconForGender(watchedIconId, avatarGender, iconMatchesGender),
              { shouldDirty: true },
            )
          }}
          disabled={isPending}
        />
        {error ? <p className="field-error">{error}</p> : null}
        <EditModalActions onClose={onClose} isPending={isPending} />
      </form>
    </Modal>
  )
}

export function CompanyRoleIdentityEditModal({
  open,
  onClose,
  title,
  initialName,
  initialIconId,
  onSubmit,
  isPending = false,
  error = null,
}: CompanyRoleEditModalProps) {
  const { t } = useTranslation(['people', 'validation'])
  const { t: tv } = useTranslation('validation')
  const editCompanyRoleProfileSchema = useMemo(() => createEditCompanyRoleProfileSchema(tv), [tv])
  const form = useForm<EditCompanyRoleProfileInput>({
    resolver: zodResolver(editCompanyRoleProfileSchema),
    defaultValues: {
      name: initialName,
      iconId: initialIconId,
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: initialName,
      iconId: initialIconId,
    })
  }, [form, initialIconId, initialName, open])

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className="create-event-form entity-edit-form" onSubmit={handleSubmit}>
        <label>
          {t('people:roles.nameLabel')}
          <input type="text" autoFocus {...form.register('name')} />
        </label>
        <AvatarSelectField
          entityType="company_role"
          value={form.watch('iconId')}
          onChange={(iconId) => form.setValue('iconId', iconId, { shouldDirty: true })}
          disabled={isPending}
          iconLabel={t('people:roles.iconLabel')}
        />
        {error ? <p className="field-error">{error}</p> : null}
        <EditModalActions onClose={onClose} isPending={isPending} />
      </form>
    </Modal>
  )
}
