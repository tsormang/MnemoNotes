import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FieldLabel } from '../../components/FieldLabel'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import { resolvePostLoginPath } from '../../lib/auth-routing'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  createAcceptInviteSchema,
  createLoginSchema,
  type AcceptInviteInput,
  type LoginInput,
} from '../../lib/validation'
import { useAuth } from './AuthProvider'

export function LoginScreen() {
  const { t } = useTranslation(['auth', 'common'])
  const { t: tv } = useTranslation('validation')
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const loginSchema = useMemo(() => createLoginSchema(tv), [tv])
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)

    if (!supabase) {
      setError(t('auth:login.supabaseNotConfigured'))
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (signInError) {
      setError(signInError.message)
      return
    }

    navigate(await resolvePostLoginPath())
  })

  return (
    <AuthFrame
      title={t('auth:login.title')}
      subtitle={t('auth:login.subtitle')}
      icon={<KeyRound size={22} aria-hidden="true" />}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          <FieldLabel required>{t('common:field.email')}</FieldLabel>
          <input type="email" autoComplete="email" placeholder={t('auth:login.emailPlaceholder')} {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          <FieldLabel required>{t('common:field.password')}</FieldLabel>
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('auth:login.passwordPlaceholder')}
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('auth:login.submitting') : t('auth:login.submit')}
        </button>
      </form>
      <SupabaseNotice />
    </AuthFrame>
  )
}

export function AcceptInviteScreen() {
  const { t } = useTranslation(['auth', 'common'])
  const { t: tv } = useTranslation('validation')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const defaultToken = useMemo(() => searchParams.get('token') ?? '', [searchParams])
  const acceptInviteSchema = useMemo(() => createAcceptInviteSchema(tv), [tv])

  const form = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      token: defaultToken,
      password: '',
      fullName: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)

    try {
      await invokeEdgeFunction<{ userId: string }>(
        'accept-invite',
        {
          token: values.token,
          password: values.password,
          fullName: values.fullName,
        },
        { requireAuth: false },
      )
      navigate('/login')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : t('auth:acceptInvite.error'))
    }
  })

  return (
    <AuthFrame
      title={t('auth:acceptInvite.title')}
      subtitle={t('auth:acceptInvite.subtitle')}
      icon={<UserPlus size={22} aria-hidden="true" />}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          <FieldLabel required>{t('auth:acceptInvite.token')}</FieldLabel>
          <input type="text" placeholder={t('auth:acceptInvite.tokenPlaceholder')} {...form.register('token')} />
          <FieldError message={form.formState.errors.token?.message} />
        </label>
        <label>
          <FieldLabel>{t('common:field.fullName')}</FieldLabel>
          <input type="text" placeholder={t('auth:acceptInvite.fullNamePlaceholder')} {...form.register('fullName')} />
          <FieldError message={form.formState.errors.fullName?.message} />
        </label>
        <label>
          <FieldLabel required>{t('common:field.password')}</FieldLabel>
          <input type="password" placeholder={t('auth:acceptInvite.passwordPlaceholder')} {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('auth:acceptInvite.submitting') : t('auth:acceptInvite.submit')}
        </button>
      </form>
      <div className="invite-card">
        <Mail size={24} aria-hidden="true" />
        <p>{t('auth:acceptInvite.info')}</p>
      </div>
      <SupabaseNotice />
    </AuthFrame>
  )
}

function AuthFrame({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode
  icon: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-icon">{icon}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null
}

function SupabaseNotice() {
  const { t } = useTranslation('auth')

  return (
    <div className="supabase-notice">
      <ShieldCheck size={18} aria-hidden="true" />
      {isSupabaseConfigured ? t('supabase.detected') : t('supabase.missing')}
    </div>
  )
}

export function SignOutButton() {
  const { t } = useTranslation('common')
  const { signOut } = useAuth()

  if (!isSupabaseConfigured) {
    return null
  }

  return (
    <button
      className="icon-ghost"
      type="button"
      aria-label={t('actions.signOut')}
      onClick={() => void signOut()}
    >
      <LogOut size={19} aria-hidden="true" />
    </button>
  )
}
