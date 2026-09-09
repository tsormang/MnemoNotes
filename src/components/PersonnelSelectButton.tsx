import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import type { Personnel } from '../types/domain'
import { IconAvatar } from './icons/IconAvatar'

interface PersonnelSelectButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  person: Pick<Personnel, 'id' | 'fullName' | 'iconId'>
  selected: boolean
  onClick: () => void
}

export function PersonnelSelectButton({
  person,
  selected,
  onClick,
  className,
  type = 'button',
  ...props
}: PersonnelSelectButtonProps) {
  return (
    <button
      type={type}
      className={clsx('assignee-option', selected && 'is-selected', className)}
      aria-pressed={props.role === 'radio' ? undefined : selected}
      onClick={onClick}
      {...props}
    >
      <span className="assignee-option__bubble">
        <IconAvatar
          iconId={person.iconId}
          entityType="personnel"
          label={person.fullName}
          size="lg"
        />
        {selected ? (
          <span className="assignee-option__check" aria-hidden="true">
            <Check size={12} strokeWidth={3.25} />
          </span>
        ) : null}
      </span>
      <span className="assignee-option__name">{person.fullName}</span>
    </button>
  )
}
