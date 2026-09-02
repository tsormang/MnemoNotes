import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={className}
        {...props}
      />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t('actions.hidePassword') : t('actions.showPassword')}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  )
})
